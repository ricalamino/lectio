import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  jsonb,
  timestamp,
  integer,
  index,
  uniqueIndex,
  customType,
} from "drizzle-orm/pg-core";

const vector = customType<{ data: number[]; driverData: string }>({
  dataType(config) {
    const dims = (config as { dimensions?: number } | undefined)?.dimensions ?? 1536;
    return `vector(${dims})`;
  },
  toDriver(value) {
    return `[${value.join(",")}]`;
  },
  fromDriver(value) {
    return JSON.parse(value as string) as number[];
  },
});

export const captureKind = pgEnum("capture_kind", [
  "text",
  "voice",
  "image",
  "link",
  "file",
]);

export const captureStatus = pgEnum("capture_status", [
  "pending",
  "enriching",
  "enriched",
  "failed",
]);

export const feedbackKind = pgEnum("feedback_kind", [
  "useful",
  "noise",
  "wrong",
  "edited",
]);

// JSON shapes — kept here as TS types so callers stay aligned with the
// prompts' output schemas (see packages/core/src/prompts/*).
export interface EnrichmentEntities {
  people?: string[];
  organizations?: string[];
  projects?: string[];
  dates?: string[];
  places?: string[];
}

export interface EnrichmentSuggestedAction {
  verb: string;
  what: string;
  when: string | null;
}

export type EnrichmentContentType =
  | "idea"
  | "task"
  | "reference"
  | "personal-fact"
  | "contact"
  | "decision"
  | "observation"
  | "other";

export const captures = pgTable(
  "captures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: captureKind("kind").notNull(),
    status: captureStatus("status").notNull().default("pending"),
    rawText: text("raw_text"),
    sourceUrl: text("source_url"),
    mediaKey: text("media_key"),
    /**
     * Stable identifier used by importers to detect a previously imported
     * capture. Null for manual captures. Format is "source:identifier"
     * (e.g. "logseq:pages/Project Lectio.md", "notion:<page_id>").
     * Unique when set — see migration 0002.
     */
    dedupeKey: text("dedupe_key"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    capturedAtIdx: index("captures_captured_at_idx").on(t.capturedAt.desc()),
    statusIdx: index("captures_status_idx").on(t.status),
  }),
);

export const enrichments = pgTable(
  "enrichments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    captureId: uuid("capture_id")
      .notNull()
      .references(() => captures.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    entities: jsonb("entities").$type<EnrichmentEntities>().notNull().default({}),
    suggestedAction: jsonb("suggested_action").$type<EnrichmentSuggestedAction | null>(),
    // Stored as text (not enum) so adding a new content_type does not require
    // a schema migration. The prompt's allowed values are documented in
    // packages/core/src/prompts/enrichment.ts.
    contentType: text("content_type").notNull(),
    transcript: text("transcript"),
    embedding: vector("embedding", { dimensions: 1536 }),
    modelProvider: text("model_provider").notNull(),
    modelName: text("model_name").notNull(),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    captureUnique: uniqueIndex("enrichments_capture_id_unique").on(t.captureId),
    contentTypeIdx: index("enrichments_content_type_idx").on(t.contentType),
  }),
);

export const feedback = pgTable(
  "feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    captureId: uuid("capture_id")
      .notNull()
      .references(() => captures.id, { onDelete: "cascade" }),
    kind: feedbackKind("kind").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    captureIdx: index("feedback_capture_idx").on(t.captureId),
  }),
);

export type Capture = typeof captures.$inferSelect;
export type NewCapture = typeof captures.$inferInsert;
export type Enrichment = typeof enrichments.$inferSelect;
export type NewEnrichment = typeof enrichments.$inferInsert;
export type Feedback = typeof feedback.$inferSelect;
export type NewFeedback = typeof feedback.$inferInsert;

export const enableExtensions = sql`CREATE EXTENSION IF NOT EXISTS vector;`;
