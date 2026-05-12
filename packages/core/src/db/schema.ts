import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  jsonb,
  timestamp,
  integer,
  real,
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

export const connectionKind = pgEnum("connection_kind", [
  "continuation",
  "contradiction",
  "pattern",
  "same_entity",
  "related",
]);

export const feedbackKind = pgEnum("feedback_kind", [
  "useful",
  "noise",
  "wrong",
  "edited",
]);

export const captures = pgTable(
  "captures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: captureKind("kind").notNull(),
    status: captureStatus("status").notNull().default("pending"),
    rawText: text("raw_text"),
    sourceUrl: text("source_url"),
    mediaKey: text("media_key"),
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
    entities: jsonb("entities").$type<string[]>().notNull().default([]),
    suggestedActions: jsonb("suggested_actions").$type<string[]>().notNull().default([]),
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
    // HNSW index for cosine similarity. Created via raw SQL in the migration
    // because drizzle-kit does not yet emit pgvector ops classes.
  }),
);

export const connections = pgTable(
  "connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fromCaptureId: uuid("from_capture_id")
      .notNull()
      .references(() => captures.id, { onDelete: "cascade" }),
    toCaptureId: uuid("to_capture_id")
      .notNull()
      .references(() => captures.id, { onDelete: "cascade" }),
    kind: connectionKind("kind").notNull(),
    rationale: text("rationale").notNull(),
    score: real("score").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    fromIdx: index("connections_from_idx").on(t.fromCaptureId),
    toIdx: index("connections_to_idx").on(t.toCaptureId),
    pairUnique: uniqueIndex("connections_pair_kind_unique").on(
      t.fromCaptureId,
      t.toCaptureId,
      t.kind,
    ),
  }),
);

export const feedback = pgTable(
  "feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    captureId: uuid("capture_id")
      .notNull()
      .references(() => captures.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id").references(() => connections.id, {
      onDelete: "cascade",
    }),
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
export type Connection = typeof connections.$inferSelect;
export type NewConnection = typeof connections.$inferInsert;
export type Feedback = typeof feedback.$inferSelect;
export type NewFeedback = typeof feedback.$inferInsert;

export const enableExtensions = sql`CREATE EXTENSION IF NOT EXISTS vector;`;
