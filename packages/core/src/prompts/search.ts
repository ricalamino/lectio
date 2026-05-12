import { z } from "zod";

// ---------- Output contract ----------
export const searchOutputSchema = z.object({
  results: z
    .array(
      z.object({
        captureId: z.string().uuid(),
        reason: z.string().min(1).max(280),
      }),
    )
    .max(20),
});

export type SearchOutput = z.infer<typeof searchOutputSchema>;

// ---------- Prompt body ----------
// Placeholder. Paste the real recall system prompt here.
export const SEARCH_SYSTEM_PROMPT = `You are Lectio's recall agent.
Given a user's natural-language query and a list of candidate captures,
return the captures that best answer the query, with a short reason for each.`;

export interface SearchCandidate {
  captureId: string;
  title: string | null;
  summary: string | null;
  rawText: string | null;
  capturedAt: Date;
}

export function searchUserPrompt(query: string, candidates: SearchCandidate[]): string {
  const formatted = candidates
    .map((c, i) => {
      const head = c.title ? `${c.title}` : "(no title)";
      const body = c.summary ?? c.rawText ?? "";
      return `[${i}] id=${c.captureId} | ${head}\n${body}`;
    })
    .join("\n\n");
  return `query: ${query}\n\ncandidates:\n${formatted}\n\nReturn JSON: { "results": [{ "captureId": "<uuid>", "reason": "<short>" }] }.`;
}
