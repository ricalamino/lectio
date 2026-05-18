import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  jsonb,
  timestamp,
  date,
  boolean,
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
    /**
     * Monotonic version per capture. Version 1 is the initial enrichment;
     * each addendum-triggered re-enrichment writes a new row with version+1.
     * Older rows are kept for history; only one row per capture has
     * `isCurrent = true` (enforced by partial unique index in migration 0006).
     */
    version: integer("version").notNull().default(1),
    isCurrent: boolean("is_current").notNull().default(true),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    entities: jsonb("entities").$type<EnrichmentEntities>().notNull().default({}),
    suggestedAction: jsonb("suggested_action").$type<EnrichmentSuggestedAction | null>(),
    // Stored as text (not enum) so adding a new content_type does not require
    // a schema migration. The prompt's allowed values are documented in
    // packages/core/src/prompts/enrichment.ts.
    contentType: text("content_type").notNull(),
    /**
     * Calendar anchor. Resolved from the enrichment payload's
     * `entities.dates` / `suggested_action.when` using the capture's
     * `capturedAt` as the relative-date anchor. Falls back to the date of
     * `capturedAt` when no explicit date is referenced — so every enriched
     * capture lands on exactly one day in the calendar view.
     */
    referenceDate: date("reference_date"),
    transcript: text("transcript"),
    embedding: vector("embedding", { dimensions: 1536 }),
    modelProvider: text("model_provider").notNull(),
    modelName: text("model_name").notNull(),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // The "one current enrichment per capture" guarantee is enforced by a
    // partial unique index on (capture_id) WHERE is_current — see migration
    // 0006. Drizzle's column API does not express partial indexes, so it
    // lives only in SQL.
    contentTypeIdx: index("enrichments_content_type_idx").on(t.contentType),
    referenceDateIdx: index("enrichments_reference_date_idx").on(t.referenceDate),
    captureVersionIdx: index("enrichments_capture_version_idx").on(t.captureId, t.version.desc()),
  }),
);

/**
 * Human-authored complementations to a capture. Append-only: each addendum is
 * a note added after the initial capture. Adding one re-enqueues enrichment
 * over the original raw text plus all addendums in chronological order.
 * Text-only for now.
 */
export const captureAddendums = pgTable(
  "capture_addendums",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    captureId: uuid("capture_id")
      .notNull()
      .references(() => captures.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    captureIdx: index("capture_addendums_capture_idx").on(t.captureId, t.createdAt),
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

// User-configurable quick-access tabs shown on the inbox. Each tab pins a
// single tag; the inbox filters captures whose enrichment includes that tag.
// Single-tenant — no user_id needed while auth is a single admin login.
export const inboxTabs = pgTable(
  "inbox_tabs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tag: text("tag").notNull(),
    label: text("label"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tagUnique: uniqueIndex("inbox_tabs_tag_unique").on(t.tag),
    positionIdx: index("inbox_tabs_position_idx").on(t.position),
  }),
);

// User-pinned items shown on the home Pinned panel and the sidebar
// shortcut. Polymorphic by `kind`: each row pins either a capture, a tag,
// or a saved search query — the matching column is filled, the others null
// (CHECK constraint enforced in migration 0007). Single-tenant for now.
export const pins = pgTable(
  "pins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull().$type<"capture" | "tag" | "search">(),
    captureId: uuid("capture_id").references(() => captures.id, {
      onDelete: "cascade",
    }),
    tag: text("tag"),
    searchQuery: text("search_query"),
    searchLabel: text("search_label"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    positionIdx: index("pins_position_idx").on(t.position),
  }),
);

export type Pin = typeof pins.$inferSelect;
export type NewPin = typeof pins.$inferInsert;

export type Capture = typeof captures.$inferSelect;
export type NewCapture = typeof captures.$inferInsert;
export type Enrichment = typeof enrichments.$inferSelect;
export type NewEnrichment = typeof enrichments.$inferInsert;
export type Feedback = typeof feedback.$inferSelect;
export type NewFeedback = typeof feedback.$inferInsert;
export type InboxTab = typeof inboxTabs.$inferSelect;
export type NewInboxTab = typeof inboxTabs.$inferInsert;
export type CaptureAddendum = typeof captureAddendums.$inferSelect;
export type NewCaptureAddendum = typeof captureAddendums.$inferInsert;

export const enableExtensions = sql`CREATE EXTENSION IF NOT EXISTS vector;`;
