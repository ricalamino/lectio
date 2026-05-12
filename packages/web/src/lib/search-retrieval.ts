import { extractCitationIds } from "@lectio/core/prompts";

/** Row shape returned by search candidate queries (lexical + vector). */
export interface SearchHitRow {
  id: string;
  rawText: string | null;
  kind: string;
  capturedAt: Date;
  title: string | null;
  summary: string | null;
  tags: string[] | null;
  suggestedAction: unknown | null;
  mediaKey: string | null;
}

/**
 * Merges vector-ranked hits first, then fills with lexical hits without
 * duplicates. Caps the list for the LLM context window.
 */
export function mergeVectorAndLexicalHits(
  vector: SearchHitRow[],
  lexical: SearchHitRow[],
  maxTotal: number,
): SearchHitRow[] {
  const seen = new Set<string>();
  const out: SearchHitRow[] = [];
  for (const row of vector) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
    if (out.length >= maxTotal) return out;
  }
  for (const row of lexical) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
    if (out.length >= maxTotal) return out;
  }
  return out;
}

/**
 * Maps [#xxxxxxxx] citation prefixes from the model answer to full capture
 * rows from the current hit list (prefix match on capture UUID).
 */
export function resolveCitationHits(answerText: string, hits: SearchHitRow[]): SearchHitRow[] {
  const prefixes = extractCitationIds(answerText);
  const cited: SearchHitRow[] = [];
  const seen = new Set<string>();
  for (const p of prefixes) {
    const lower = p.toLowerCase();
    const row = hits.find((h) => h.id.slice(0, 8).toLowerCase() === lower);
    if (row && !seen.has(row.id)) {
      seen.add(row.id);
      cited.push(row);
    }
  }
  return cited;
}
