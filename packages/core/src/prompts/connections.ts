import { z } from "zod";

/**
 * Connection prompt: validates whether two captures (one new,
 * one prior, already filtered by vector similarity) deserve an
 * explicit connection — or if the similarity is superficial and
 * the suggestion would be noise.
 *
 * Default stance: DO NOT connect. The user's trust degrades
 * faster from bad suggestions than it grows from good ones.
 *
 * Output: strict JSON. Cheaper model is fine here (binary-ish
 * decision with clear criteria).
 */

export const CONNECTION_SYSTEM_PROMPT = `
You decide whether two captures the user made deserve to be
explicitly connected — or whether the similarity between them
is superficial and the suggestion would be noise.

## The contract

You are protecting the user from useless notifications. Every
suggested connection they reject costs trust in the app. Every
suggested connection they accept builds the perception that
"this app thinks for me."

**Default: DO NOT connect.** Only connect when there's a
nameable reason that makes the user think "oh, right."

## Connection types that ARE worth surfacing

1. **Continuation**: B is a follow-up, update, or development
   of A.
   Ex: A "Marina wants to go solo" + B "Marina asked me for
   infra help today" → CONNECT (continuation)

2. **Contradiction**: B contradicts or complicates A.
   Ex: A "decided not to take new clients this month" + B
   "closed proposal with Acme" → CONNECT (contradiction worth
   the user's attention)

3. **Pattern**: B is the 3rd+ instance of a pattern that A
   starts or exemplifies.
   Ex: A "patient minimized before crying" + B (weeks later)
   "another patient said 'I'm fine' three times before
   breaking down" → CONNECT (emerging clinical pattern)

4. **Same entity, new context**: B brings new information
   about a person/project/company from A.
   Ex: A "John asked for a discount" + B "John approved the
   full budget" → CONNECT

5. **Question-answer**: B answers an implicit question in A.
   Ex: A "wonder if pgvector scales?" + B "read pgvector
   handles millions of rows with IVFFlat" → CONNECT

## Connection types that are NOT worth surfacing

- **Same broad topic**: both are about "work," "AI," "health."
  Topic is not connection.
- **Same entity without new info**: A mentions John, B mentions
  John, but B adds nothing new about John.
- **Stylistic similarity**: both are reflective notes, both
  are tasks. Form is not connection.
- **Temporal coincidence**: captured the same day but about
  different things.
- **"Might be related"**: if you have to hesitate, reject.

## Output format

Return ONLY valid JSON, no markdown:

{
  "verdict": "connect" | "skip",
  "type": "continuation" | "contradiction" | "pattern" |
          "entity-update" | "question-answer" | null,
  "reason": string,    // if connect: 1 short sentence shown to
                       // the user ("this seems to continue X").
                       // If skip: 1 internal sentence explaining
                       // the rejection.
  "confidence": "high" | "medium" | "low"
}

Only "high" and "medium" connections are surfaced to the user.
"low" is logged but hidden. Use "low" liberally when uncertain
— it's better than "skip" because it allows later review.
`.trim();

// ---------- Output contract ----------

export const connectionVerdictEnum = z.enum(["connect", "skip"]);
// The prompt uses kebab-case ("entity-update", "question-answer") in JSON.
// The DB enum uses snake_case ("entity_update", "question_answer") because
// Postgres enums conventionally don't use hyphens. `normalizeConnectionType`
// below bridges the two.
export const connectionTypeEnum = z.enum([
  "continuation",
  "contradiction",
  "pattern",
  "entity-update",
  "question-answer",
]);
export const connectionConfidenceEnum = z.enum(["high", "medium", "low"]);

export const connectionOutputSchema = z
  .object({
    verdict: connectionVerdictEnum,
    type: connectionTypeEnum.nullable(),
    reason: z.string().min(1),
    confidence: connectionConfidenceEnum,
  })
  .strict();

export type ConnectionOutput = z.infer<typeof connectionOutputSchema>;
export type ConnectionType = z.infer<typeof connectionTypeEnum>;

const TYPE_TO_DB: Record<ConnectionType, string> = {
  continuation: "continuation",
  contradiction: "contradiction",
  pattern: "pattern",
  "entity-update": "entity_update",
  "question-answer": "question_answer",
};

export function normalizeConnectionType(
  type: ConnectionType,
): "continuation" | "contradiction" | "pattern" | "entity_update" | "question_answer" {
  return TYPE_TO_DB[type] as ReturnType<typeof normalizeConnectionType>;
}

// ---------- User message builder ----------

export interface ConnectionCaptureRef {
  capture_id: string;
  title: string;
  tags: string[];
  raw_content: string;
  created_at: string;
}

export function buildConnectionUserMessage(params: {
  newCapture: {
    id: string;
    title: string;
    tags: string[];
    raw_content: string;
    created_at: string;
  };
  candidate: ConnectionCaptureRef & { similarity: number };
}): string {
  const { newCapture, candidate } = params;
  return `
## New capture
[id: ${newCapture.id.slice(0, 8)}]
[date: ${newCapture.created_at}]
[title: ${newCapture.title}]
[tags: ${newCapture.tags.join(", ")}]
[content]: ${newCapture.raw_content}

## Candidate capture (captured earlier)
[id: ${candidate.capture_id.slice(0, 8)}]
[date: ${candidate.created_at}]
[title: ${candidate.title}]
[tags: ${candidate.tags.join(", ")}]
[content]: ${candidate.raw_content}

[vector similarity: ${candidate.similarity.toFixed(2)}]

Evaluate whether this deserves an explicit connection.
`.trim();
}
