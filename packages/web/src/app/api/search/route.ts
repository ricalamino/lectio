import { NextResponse } from "next/server";
import { and, desc, eq, ilike, isNotNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { captures, enrichments } from "@lectio/core/db/schema";
import { createProvider, type LlmProviderName } from "@lectio/core/llm";
import {
  buildSearchUserMessage,
  SEARCH_SYSTEM_PROMPT,
  type SearchCandidate,
} from "@lectio/core/prompts";
import {
  mergeVectorAndLexicalHits,
  resolveCitationHits,
  type SearchHitRow,
} from "@/lib/search-retrieval";

const STOP_WORDS = new Set([
  "a",
  "as",
  "com",
  "da",
  "de",
  "do",
  "e",
  "eh",
  "em",
  "eu",
  "minha",
  "meu",
  "o",
  "os",
  "para",
  "qual",
  "quando",
  "que",
  "tenho",
]);

function searchTerms(q: string): string[] {
  const normalized = q
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return Array.from(
    new Set(normalized.match(/[\p{L}\p{N}]+/gu)?.filter((term) => {
      return term.length > 2 && !STOP_WORDS.has(term);
    }) ?? []),
  ).slice(0, 6);
}

function fieldMatches(pattern: string): SQL[] {
  return [
    ilike(captures.rawText, pattern),
    ilike(captures.sourceUrl, pattern),
    ilike(enrichments.title, pattern),
    ilike(enrichments.summary, pattern),
    sql`${enrichments.tags}::text ilike ${pattern}`,
    sql`${enrichments.entities}::text ilike ${pattern}`,
    sql`${enrichments.suggestedAction}::text ilike ${pattern}`,
  ];
}

function providerName(value: string): LlmProviderName {
  switch (value) {
    case "anthropic":
    case "openai":
    case "google":
    case "ollama":
    case "openrouter":
    case "openai-compatible":
      return value;
    default:
      throw new Error(`Unsupported search provider: ${value}`);
  }
}

function toCandidate(row: SearchHitRow): SearchCandidate {
  return {
    capture_id: row.id,
    title: row.title ?? "Untitled capture",
    summary: row.summary ?? row.rawText ?? "",
    tags: row.tags ?? [],
    raw_content: row.rawText ?? "",
    created_at: row.capturedAt.toISOString(),
  };
}

/**
 * Builds AND-joined `tags @> '["tag"]'::jsonb` predicates. Empty array
 * returns null — callers must skip applying it. Using jsonb containment
 * (vs ilike on serialized text) avoids false matches across tag
 * boundaries ("ai" matching "trail") and uses the GIN index when present.
 */
function tagsContainAll(tags: string[]): SQL | null {
  if (tags.length === 0) return null;
  const predicates = tags.map(
    (tag) => sql`${enrichments.tags} @> ${JSON.stringify([tag])}::jsonb`,
  );
  return and(...predicates) ?? null;
}

async function loadLexicalCandidates(q: string, tags: string[]): Promise<SearchHitRow[]> {
  const terms = searchTerms(q);
  const patterns = [`%${q}%`, ...terms.map((term) => `%${term}%`)];
  const textPredicate = or(...patterns.flatMap(fieldMatches));
  const tagPredicate = tagsContainAll(tags);
  const where = tagPredicate ? and(textPredicate, tagPredicate) : textPredicate;

  return db()
    .select({
      id: captures.id,
      rawText: captures.rawText,
      kind: captures.kind,
      capturedAt: captures.capturedAt,
      mediaKey: captures.mediaKey,
      title: enrichments.title,
      summary: enrichments.summary,
      tags: enrichments.tags,
      suggestedAction: enrichments.suggestedAction,
    })
    .from(captures)
    .leftJoin(enrichments, eq(enrichments.captureId, captures.id))
    .where(where)
    .orderBy(desc(captures.capturedAt))
    .limit(24);
}

async function loadVectorCandidates(
  queryEmbedding: number[],
  limit: number,
  tags: string[],
): Promise<SearchHitRow[]> {
  const vector = `[${queryEmbedding.join(",")}]`;
  const tagPredicate = tagsContainAll(tags);
  const where = tagPredicate
    ? and(isNotNull(enrichments.embedding), tagPredicate)
    : isNotNull(enrichments.embedding);

  return db()
    .select({
      id: captures.id,
      rawText: captures.rawText,
      kind: captures.kind,
      capturedAt: captures.capturedAt,
      mediaKey: captures.mediaKey,
      title: enrichments.title,
      summary: enrichments.summary,
      tags: enrichments.tags,
      suggestedAction: enrichments.suggestedAction,
    })
    .from(captures)
    .innerJoin(enrichments, eq(enrichments.captureId, captures.id))
    .where(where)
    .orderBy(sql`${enrichments.embedding} <=> ${vector}::vector`)
    .limit(limit);
}

async function embedQuery(q: string, config: ReturnType<typeof env>): Promise<number[] | null> {
  const model = config.LECTIO_EMBED_MODEL;
  if (!model) return null;

  if (config.LECTIO_EMBED_PROVIDER === "openai") {
    if (!config.OPENAI_API_KEY) return null;
    const openai = createProvider("openai", config);
    const result = await openai.embed({ model, input: q });
    return result.embeddings[0] ?? null;
  }

  if (config.LECTIO_EMBED_PROVIDER === "ollama") {
    if (!config.OLLAMA_BASE_URL) return null;
    const ollama = createProvider("ollama", config);
    const result = await ollama.embed({ model, input: q });
    return result.embeddings[0] ?? null;
  }

  return null;
}

async function loadLexicalByTagsOnly(tags: string[]): Promise<SearchHitRow[]> {
  const tagPredicate = tagsContainAll(tags);
  if (!tagPredicate) return [];
  return db()
    .select({
      id: captures.id,
      rawText: captures.rawText,
      kind: captures.kind,
      capturedAt: captures.capturedAt,
      mediaKey: captures.mediaKey,
      title: enrichments.title,
      summary: enrichments.summary,
      tags: enrichments.tags,
      suggestedAction: enrichments.suggestedAction,
    })
    .from(captures)
    .innerJoin(enrichments, eq(enrichments.captureId, captures.id))
    .where(tagPredicate)
    .orderBy(desc(captures.capturedAt))
    .limit(50);
}

function sseEvent(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  // Normalize: dedupe, drop empties. Multiple tag params combine with AND
  // (capture must carry every selected tag). Driven by chip toggles in the
  // search UI.
  const tags = Array.from(
    new Set(url.searchParams.getAll("tag").map((t) => t.trim()).filter(Boolean)),
  );

  if (!q && tags.length === 0) {
    return NextResponse.json({ answer: null, hits: [], cited: [] });
  }

  const config = env();

  // Tag-only filter: skip the LLM entirely. The user is browsing, not
  // asking a question, so we just list the matching captures. Saves all
  // the search prompt tokens.
  if (!q) {
    const rows = await loadLexicalByTagsOnly(tags);
    return NextResponse.json({ answer: null, hits: rows, cited: [] });
  }

  const [queryEmbedding, lexicalRows] = await Promise.all([
    embedQuery(q, config),
    loadLexicalCandidates(q, tags),
  ]);

  const vectorRows =
    queryEmbedding && queryEmbedding.length > 0
      ? await loadVectorCandidates(queryEmbedding, 24, tags)
      : [];

  const rows = mergeVectorAndLexicalHits(vectorRows, lexicalRows, 20);

  if (rows.length === 0) {
    return NextResponse.json({
      answer: "Não encontrei nada direto nas suas capturas.",
      hits: [],
      cited: [],
    });
  }

  const llm = createProvider(providerName(config.LECTIO_SEARCH_PROVIDER), config);
  const messages: Parameters<typeof llm.complete>[0]["messages"] = [
    { role: "system", content: SEARCH_SYSTEM_PROMPT },
    { role: "user", content: buildSearchUserMessage({ query: q, candidates: rows.map(toCandidate) }) },
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let answerText = "";
      try {
        for await (const chunk of llm.completeStream({
          model: config.LECTIO_SEARCH_MODEL,
          maxTokens: 600,
          temperature: 0,
          messages,
        })) {
          answerText += chunk;
          controller.enqueue(encoder.encode(sseEvent({ type: "chunk", text: chunk })));
        }
      } catch {
        controller.enqueue(encoder.encode(sseEvent({ type: "error" })));
        controller.close();
        return;
      }
      const cited = resolveCitationHits(answerText, rows);
      controller.enqueue(
        encoder.encode(sseEvent({ type: "done", answer: answerText, hits: rows, cited })),
      );
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
