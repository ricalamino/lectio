import { z } from "zod";

// ---------- Output contract ----------
// Locked shape that the enrichment worker writes into the `enrichments` table.
// If you change this, also update the table and the DB write in
// packages/worker/src/handlers/enrich.ts.
export const enrichmentOutputSchema = z.object({
  title: z.string().min(1).max(200),
  summary: z.string().min(1).max(2000),
  tags: z.array(z.string().min(1).max(40)).max(20).default([]),
  entities: z.array(z.string().min(1).max(80)).max(30).default([]),
  suggestedActions: z.array(z.string().min(1).max(140)).max(8).default([]),
});

export type EnrichmentOutput = z.infer<typeof enrichmentOutputSchema>;

// ---------- Prompt body ----------
// Placeholder. Paste the real system prompt here. The body is free-form —
// the only requirement is that the model returns JSON matching
// `enrichmentOutputSchema` above.
export const ENRICHMENT_SYSTEM_PROMPT = `You are Lectio's enrichment worker.
Given a raw capture, output a JSON object with title, summary, tags,
entities, and suggestedActions. Be terse. Use the language of the input.`;

export interface EnrichmentInput {
  rawText: string;
  kind: "text" | "voice" | "image" | "link" | "file";
  capturedAt: Date;
  sourceUrl?: string | null;
}

export function enrichmentUserPrompt(input: EnrichmentInput): string {
  const meta = [
    `kind: ${input.kind}`,
    `captured_at: ${input.capturedAt.toISOString()}`,
    input.sourceUrl ? `source_url: ${input.sourceUrl}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  return `${meta}\n\n--- capture ---\n${input.rawText}\n--- end capture ---\n\nReturn JSON with keys: title, summary, tags, entities, suggestedActions.`;
}
