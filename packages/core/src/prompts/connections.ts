import { z } from "zod";

// ---------- Output contract ----------
// Matches the `connections` table's `kind` enum + score range.
export const connectionKindEnum = z.enum([
  "continuation",
  "contradiction",
  "pattern",
  "same_entity",
  "related",
]);

export const connectionsOutputSchema = z.object({
  connections: z
    .array(
      z.object({
        toCaptureId: z.string().uuid(),
        kind: connectionKindEnum,
        rationale: z.string().min(1).max(280),
        score: z.number().min(0).max(1),
      }),
    )
    .max(10),
});

export type ConnectionsOutput = z.infer<typeof connectionsOutputSchema>;

// ---------- Prompt body ----------
// Placeholder. Paste the real connections system prompt here.
export const CONNECTIONS_SYSTEM_PROMPT = `You are Lectio's connections worker.
Given a new capture and its nearest neighbours, propose non-obvious links:
continuation, contradiction, pattern, same_entity, or related. Skip the obvious.`;

export interface ConnectionsNeighbour {
  captureId: string;
  title: string | null;
  summary: string | null;
  capturedAt: Date;
}

export interface ConnectionsInput {
  newCapture: {
    captureId: string;
    title: string;
    summary: string;
  };
  neighbours: ConnectionsNeighbour[];
}

export function connectionsUserPrompt(input: ConnectionsInput): string {
  const neighbours = input.neighbours
    .map(
      (n) =>
        `- id=${n.captureId} | ${n.title ?? "(no title)"} :: ${n.summary ?? ""}`,
    )
    .join("\n");
  return `new capture:\nid=${input.newCapture.captureId}\ntitle=${input.newCapture.title}\nsummary=${input.newCapture.summary}\n\nneighbours:\n${neighbours}\n\nReturn JSON: { "connections": [{ "toCaptureId": "<uuid>", "kind": "<kind>", "rationale": "<short>", "score": <0..1> }] }. Omit weak links — never invent neighbours not in the list.`;
}
