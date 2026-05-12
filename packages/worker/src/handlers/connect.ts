import { and, desc, eq, ilike, isNotNull, lt, notExists, or, sql, type SQL } from "drizzle-orm";
import type { Database } from "@lectio/core/db";
import { captures, connections, enrichments, rejectedConnectionEdges } from "@lectio/core/db/schema";
import type { LlmProvider } from "@lectio/core/llm";
import {
  buildConnectionUserMessage,
  CONNECTION_SYSTEM_PROMPT,
  connectionOutputSchema,
  normalizeConnectionType,
} from "@lectio/core/prompts";
import type { ConnectJob } from "../jobs.js";

export interface ConnectDeps {
  db: Database;
  llm: LlmProvider;
  model: string;
  candidateLimit?: number;
}

interface CaptureWithEnrichment {
  id: string;
  rawText: string | null;
  capturedAt: Date;
  title: string;
  summary: string;
  tags: string[];
  embedding: number[] | null;
}

interface CandidateConnection {
  id: string;
  rawText: string | null;
  capturedAt: Date;
  title: string;
  summary: string;
  tags: string[];
  similarity: number;
}

const STOP_WORDS = new Set([
  "about",
  "and",
  "com",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "for",
  "from",
  "have",
  "the",
  "that",
  "this",
  "uma",
  "was",
  "with",
]);

function safeTags(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((tag): tag is string => typeof tag === "string") : [];
}

function toCaptureRef(capture: CaptureWithEnrichment) {
  return {
    id: capture.id,
    title: capture.title,
    tags: capture.tags,
    raw_content: [capture.rawText, capture.summary].filter(Boolean).join("\n\n"),
    created_at: capture.capturedAt.toISOString(),
  };
}

function lexicalTerms(capture: CaptureWithEnrichment): string[] {
  const text = [capture.title, capture.summary, capture.rawText, ...capture.tags]
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return Array.from(
    new Set(
      text.match(/[\p{L}\p{N}]+/gu)?.filter((term) => {
        return term.length > 3 && !STOP_WORDS.has(term);
      }) ?? [],
    ),
  ).slice(0, 8);
}

async function loadCapture(
  db: Database,
  captureId: string,
): Promise<CaptureWithEnrichment | null> {
  const [row] = await db
    .select({
      id: captures.id,
      rawText: captures.rawText,
      capturedAt: captures.capturedAt,
      title: enrichments.title,
      summary: enrichments.summary,
      tags: enrichments.tags,
      embedding: enrichments.embedding,
    })
    .from(captures)
    .innerJoin(enrichments, eq(enrichments.captureId, captures.id))
    .where(eq(captures.id, captureId));

  if (!row) return null;
  return { ...row, tags: safeTags(row.tags) };
}

async function loadVectorCandidates(
  db: Database,
  capture: CaptureWithEnrichment,
  limit: number,
): Promise<CandidateConnection[]> {
  if (!capture.embedding) return [];
  const vector = `[${capture.embedding.join(",")}]`;

  const rows = await db
    .select({
      id: captures.id,
      rawText: captures.rawText,
      capturedAt: captures.capturedAt,
      title: enrichments.title,
      summary: enrichments.summary,
      tags: enrichments.tags,
      similarity: sql<number>`1 - (${enrichments.embedding} <=> ${vector}::vector)`,
    })
    .from(enrichments)
    .innerJoin(captures, eq(captures.id, enrichments.captureId))
    .where(
      and(
        isNotNull(enrichments.embedding),
        lt(captures.capturedAt, capture.capturedAt),
        notExists(
          db
            .select({ id: connections.id })
            .from(connections)
            .where(
              and(
                eq(connections.fromCaptureId, capture.id),
                eq(connections.toCaptureId, captures.id),
              ),
            ),
        ),
        notExists(
          db
            .select({ id: rejectedConnectionEdges.fromCaptureId })
            .from(rejectedConnectionEdges)
            .where(
              and(
                eq(rejectedConnectionEdges.fromCaptureId, capture.id),
                eq(rejectedConnectionEdges.toCaptureId, captures.id),
              ),
            ),
        ),
      ),
    )
    .orderBy(sql`${enrichments.embedding} <=> ${vector}::vector`)
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    tags: safeTags(row.tags),
    similarity: Number(row.similarity),
  }));
}

async function loadLexicalCandidates(
  db: Database,
  capture: CaptureWithEnrichment,
  limit: number,
): Promise<CandidateConnection[]> {
  const terms = lexicalTerms(capture);
  if (terms.length === 0) return [];

  const conditions = terms.flatMap<SQL>((term) => {
    const pattern = `%${term}%`;
    return [
      ilike(captures.rawText, pattern),
      ilike(enrichments.title, pattern),
      ilike(enrichments.summary, pattern),
      sql`${enrichments.tags}::text ilike ${pattern}`,
      sql`${enrichments.entities}::text ilike ${pattern}`,
    ];
  });

  const rows = await db
    .select({
      id: captures.id,
      rawText: captures.rawText,
      capturedAt: captures.capturedAt,
      title: enrichments.title,
      summary: enrichments.summary,
      tags: enrichments.tags,
    })
    .from(enrichments)
    .innerJoin(captures, eq(captures.id, enrichments.captureId))
    .where(
      and(
        lt(captures.capturedAt, capture.capturedAt),
        or(...conditions),
        notExists(
          db
            .select({ id: connections.id })
            .from(connections)
            .where(
              and(
                eq(connections.fromCaptureId, capture.id),
                eq(connections.toCaptureId, captures.id),
              ),
            ),
        ),
        notExists(
          db
            .select({ id: rejectedConnectionEdges.fromCaptureId })
            .from(rejectedConnectionEdges)
            .where(
              and(
                eq(rejectedConnectionEdges.fromCaptureId, capture.id),
                eq(rejectedConnectionEdges.toCaptureId, captures.id),
              ),
            ),
        ),
      ),
    )
    .orderBy(desc(captures.capturedAt))
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    tags: safeTags(row.tags),
    // Lexical candidates are weaker than vector candidates; keep the prompt
    // conservative by reporting a medium-low synthetic similarity.
    similarity: 0.62,
  }));
}

export async function handleConnect(data: ConnectJob, deps: ConnectDeps): Promise<void> {
  const capture = await loadCapture(deps.db, data.captureId);
  if (!capture) return;

  const limit = deps.candidateLimit ?? 8;
  const vectorCandidates = await loadVectorCandidates(deps.db, capture, limit);
  const candidates =
    vectorCandidates.length > 0
      ? vectorCandidates
      : await loadLexicalCandidates(deps.db, capture, limit);
  if (candidates.length === 0) return;

  const newCapture = toCaptureRef(capture);
  for (const candidate of candidates) {
    const result = await deps.llm.completeJson({
      model: deps.model,
      maxTokens: 512,
      temperature: 0,
      messages: [
        { role: "system", content: CONNECTION_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildConnectionUserMessage({
            newCapture,
            candidate: {
              capture_id: candidate.id,
              title: candidate.title,
              tags: candidate.tags,
              raw_content: [candidate.rawText, candidate.summary].filter(Boolean).join("\n\n"),
              created_at: candidate.capturedAt.toISOString(),
              similarity: candidate.similarity,
            },
          }),
        },
      ],
      schema: connectionOutputSchema,
    });

    if (
      result.data.verdict !== "connect" ||
      !result.data.type ||
      result.data.confidence === "low"
    ) {
      continue;
    }

    await deps.db
      .insert(connections)
      .values({
        fromCaptureId: capture.id,
        toCaptureId: candidate.id,
        kind: normalizeConnectionType(result.data.type),
        reason: result.data.reason,
        confidence: result.data.confidence,
        score: candidate.similarity,
      })
      .onConflictDoNothing({
        target: [connections.fromCaptureId, connections.toCaptureId, connections.kind],
      });
  }
}
