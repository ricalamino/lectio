import { z } from "zod";

/**
 * Enrichment prompt: turns a raw capture (text, transcribed audio,
 * extracted image content, or fetched link) into structured metadata
 * that makes it findable and connectable later.
 *
 * Output: strict JSON, parsed downstream. No markdown, no preamble.
 */

export const ENRICHMENT_SYSTEM_PROMPT = `
You are the silent organizer of a personal "second brain."

Your only task: receive a raw piece of information the user
captured (without bothering to organize it) and return
structured metadata that makes the capture **findable and
connectable** later.

## Principles

1. **Think like the user who will search for this in 3 months.**
   What words will they use when they don't remember exactly
   what they captured? Those become the title and tags.

2. **Summarize what IS there, not what it seems.** If the user
   captured only "call John about proposal," don't invent
   context. A short, faithful summary beats a beautiful,
   invented one.

3. **Tags are search keys, not academic categories.** Prefer
   concrete terms ("budget-acme") over abstract ones
   ("strategic-planning"). Include named entities as tags
   when they appear.

4. **Identify implicit action.** If the capture suggests
   something to do (even if the user didn't write "do X"),
   mark it in suggested_action. If nothing actionable is
   implied, leave it null. Don't force it.

5. **When in doubt, capture fewer fields with more precision**
   rather than many vague ones. Vague tags hurt search; better
   to have 2 good ones than 5 bad ones.

## Output format

Return exactly ONE JSON object for the entire capture, even
when the input has multiple bullet sections or topics. Never
return an array. If several themes appear, synthesize one
combined title, summary, and tag set for the whole capture.

Return ONLY a valid JSON object, with no markdown, no
comments, no text before or after. Schema:

{
  "title": string,           // 3-8 words, descriptive,
                             // sentence case, no unnecessary
                             // capitals
  "summary": string,         // 1-2 sentences. What this is
                             // and why the user captured it.
                             // If the original input is short,
                             // the summary can be identical
                             // to the input.
  "tags": string[],          // 3-5 tags. lowercase-with-hyphens.
                             // Include entities (people,
                             // companies, projects) and topics.
  "entities": {              // Structured extraction. Omit
                             // empty keys entirely.
    "people": string[],
    "organizations": string[],
    "projects": string[],
    "dates": string[],       // ISO 8601 when absolute,
                             // original expression when
                             // relative ("next Friday")
    "places": string[]
  },
  "suggested_action": {      // null if no clear action
    "verb": string,          // "call", "reply", "buy", "read",
                             // "schedule", etc.
    "what": string,          // short description of the action
    "when": string | null    // if there's a time indication
  } | null,
  "content_type": string     // "idea" | "task" | "reference"
                             // | "personal-fact" | "contact"
                             // | "decision" | "observation"
                             // | "other"
}

## Examples

INPUT: "call John from Acme about the proposal before Friday,
he was worried about the deadline"

OUTPUT:
{
  "title": "call john acme about proposal",
  "summary": "Get back to John at Acme before Friday about the proposal — he expressed concern about the deadline.",
  "tags": ["acme", "john", "proposal", "deadline", "follow-up"],
  "entities": {
    "people": ["John"],
    "organizations": ["Acme"],
    "dates": ["next Friday"]
  },
  "suggested_action": {
    "verb": "call",
    "what": "get back to John about the proposal",
    "when": "before Friday"
  },
  "content_type": "task"
}

INPUT: "interesting how in today's session the patient repeated
three times 'it's nothing' before crying"

OUTPUT:
{
  "title": "patient minimizes before crying",
  "summary": "Clinical observation: pattern of verbal minimization ('it's nothing,' repeated 3x) preceding emotional release.",
  "tags": ["clinical", "session-note", "defense", "minimization"],
  "entities": {},
  "suggested_action": null,
  "content_type": "observation"
}

INPUT: "https://arxiv.org/abs/2401.12345 — paper on autonomous
agents with self-correction, read later"

OUTPUT:
{
  "title": "paper on autonomous agents self-correction",
  "summary": "arXiv paper on autonomous agents with self-correction mechanisms. Saved for later reading.",
  "tags": ["paper", "ai-agents", "self-correction", "arxiv", "to-read"],
  "entities": {
    "organizations": ["arXiv"]
  },
  "suggested_action": {
    "verb": "read",
    "what": "paper on autonomous agents with self-correction",
    "when": null
  },
  "content_type": "reference"
}

INPUT: "had coffee with Marina today, she's leaving her company
and wants to go solo, mentioned she might need help with infra"

OUTPUT:
{
  "title": "marina leaving company going solo",
  "summary": "Marina is leaving her current company to go independent. Mentioned she might need help with infrastructure.",
  "tags": ["marina", "networking", "opportunity", "freelance-lead", "infra"],
  "entities": {
    "people": ["Marina"]
  },
  "suggested_action": null,
  "content_type": "personal-fact"
}
`.trim();

// ---------- Output contract ----------

export const enrichmentContentTypeEnum = z.enum([
  "idea",
  "task",
  "reference",
  "personal-fact",
  "contact",
  "decision",
  "observation",
  "other",
]);

const stringArray = z.array(z.string().min(1));

const entityKeys = ["people", "organizations", "projects", "dates", "places"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeContentType(value: unknown): z.infer<typeof enrichmentContentTypeEnum> {
  const parsed = enrichmentContentTypeEnum.safeParse(value);
  return parsed.success ? parsed.data : "other";
}

function normalizeSuggestedAction(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) return null;
  const verb = typeof value.verb === "string" ? value.verb.trim() : "";
  const what = typeof value.what === "string" ? value.what.trim() : "";
  if (!verb || !what) return null;
  const whenRaw = value.when;
  if (whenRaw === null || whenRaw === undefined || whenRaw === "") return { verb, what, when: null };
  if (typeof whenRaw !== "string") return { verb, what, when: null };
  const when = whenRaw.trim();
  return { verb, what, when: when.length > 0 ? when : null };
}

function normalizeEntities(value: unknown): Record<string, string[]> {
  if (!isRecord(value)) return {};
  const out: Partial<Record<(typeof entityKeys)[number], string[]>> = {};
  for (const key of entityKeys) {
    const list = value[key];
    if (!Array.isArray(list)) continue;
    const clean = list
      .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      .map((entry) => entry.trim());
    if (clean.length > 0) out[key] = clean;
  }
  return out;
}

function mergeEntityLists(items: Record<string, unknown>[], key: (typeof entityKeys)[number]): string[] | undefined {
  const merged = new Set<string>();
  for (const item of items) {
    if (!isRecord(item.entities)) continue;
    const list = item.entities[key];
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      if (typeof entry === "string" && entry.trim().length > 0) merged.add(entry.trim());
    }
  }
  return merged.size > 0 ? [...merged] : undefined;
}

function mergeEnrichmentItems(items: unknown[]): Record<string, unknown> {
  const records = items.filter(isRecord);
  if (records.length === 0) return {};

  const titles = records
    .map((item) => item.title)
    .filter((title): title is string => typeof title === "string" && title.trim().length > 0)
    .map((title) => title.trim());
  const summaries = records
    .map((item) => item.summary)
    .filter((summary): summary is string => typeof summary === "string" && summary.trim().length > 0)
    .map((summary) => summary.trim());
  const tags = new Set<string>();
  for (const item of records) {
    if (!Array.isArray(item.tags)) continue;
    for (const tag of item.tags) {
      if (typeof tag === "string" && tag.trim().length > 0) tags.add(tag.trim());
    }
  }

  const entities: Record<string, string[]> = {};
  for (const key of entityKeys) {
    const merged = mergeEntityLists(records, key);
    if (merged) entities[key] = merged;
  }

  const suggested_action =
    records.map((item) => normalizeSuggestedAction(item.suggested_action)).find((value) => value !== null) ?? null;

  const contentTypes = records.map((item) => normalizeContentType(item.content_type)).filter((value) => value !== "other");
  const content_type = contentTypes.length === 1 ? contentTypes[0]! : "other";

  return {
    title: titles[0] ?? "untitled capture",
    summary: summaries.length > 0 ? summaries.join(" ") : (titles[0] ?? "untitled capture"),
    tags: [...tags],
    entities,
    suggested_action,
    content_type,
  };
}

function normalizeEnrichmentPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    if (value.length === 0) return {};
    if (value.length === 1) value = value[0];
    else return mergeEnrichmentItems(value);
  }
  if (!isRecord(value)) return value;

  return {
    ...value,
    title: typeof value.title === "string" ? value.title.trim() : value.title,
    summary: typeof value.summary === "string" ? value.summary.trim() : value.summary,
    tags: Array.isArray(value.tags)
      ? value.tags
          .filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
          .map((tag) => tag.trim())
      : value.tags,
    entities: normalizeEntities(value.entities),
    suggested_action: normalizeSuggestedAction(value.suggested_action),
    content_type: normalizeContentType(value.content_type),
  };
}

export const enrichmentEntitiesSchema = z
  .object({
    people: stringArray.optional(),
    organizations: stringArray.optional(),
    projects: stringArray.optional(),
    dates: stringArray.optional(),
    places: stringArray.optional(),
  })
  .strict();

export const enrichmentSuggestedActionSchema = z
  .object({
    verb: z.string().min(1),
    what: z.string().min(1),
    when: z.string().min(1).nullable(),
  })
  .strict();

const enrichmentOutputObjectSchema = z
  .object({
    title: z.string().min(1),
    summary: z.string().min(1),
    tags: stringArray.default([]),
    entities: enrichmentEntitiesSchema.default({}),
    suggested_action: enrichmentSuggestedActionSchema.nullable().default(null),
    content_type: enrichmentContentTypeEnum,
  })
  .strict();

export type EnrichmentOutput = z.infer<typeof enrichmentOutputObjectSchema>;

export const enrichmentOutputSchema = z.preprocess(
  normalizeEnrichmentPayload,
  enrichmentOutputObjectSchema,
) as z.ZodType<EnrichmentOutput>;

// ---------- User message builder ----------

export type EnrichmentMediaType = "text" | "audio" | "image" | "link";

export function buildEnrichmentUserMessage(params: {
  rawContent: string;
  mediaType: EnrichmentMediaType;
}): string {
  return `[type: ${params.mediaType}]\n\n${params.rawContent}`;
}
