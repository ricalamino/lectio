/**
 * Idempotent insert for imported captures.
 *
 * Identity is `dedupe_key`. When a capture with that key already exists we
 * compare a SHA-256 of `rawText`:
 *   - same hash → no-op ("unchanged"). The caller should NOT re-enqueue.
 *   - different hash → update rawText/metadata, reset to "pending", delete the
 *     old enrichment, and tell the caller to re-enqueue an enrich job.
 *
 * Notion bypasses the hash and uses `lastEditedAt` (the API already tracks it).
 */

import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { captures, enrichments } from "../db/schema.js";

export type UpsertAction = "inserted" | "updated" | "unchanged";

export interface UpsertImportRow {
  dedupeKey: string;
  rawText: string;
  metadata: Record<string, unknown>;
  /**
   * When provided, we use this instead of the raw-text hash to detect change.
   * Notion sets it to `last_edited_time` so re-imports skip cleanly without
   * re-fetching every block. Markdown/Logseq leave it undefined.
   */
  changeMarker?: string;
}

export interface UpsertResult {
  id: string;
  action: UpsertAction;
}

function hashText(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/**
 * Bake the change marker into a stable string saved in metadata so we can
 * compare on the next import without re-hashing the existing row.
 */
function markerFor(row: UpsertImportRow): string {
  return row.changeMarker ?? `sha256:${hashText(row.rawText)}`;
}

const MARKER_META_KEY = "_dedupeMarker";

export async function upsertImportedCapture(
  db: Database,
  row: UpsertImportRow,
): Promise<UpsertResult> {
  const marker = markerFor(row);
  const metadataWithMarker = { ...row.metadata, [MARKER_META_KEY]: marker };

  const [existing] = await db
    .select({ id: captures.id, metadata: captures.metadata })
    .from(captures)
    .where(eq(captures.dedupeKey, row.dedupeKey));

  if (!existing) {
    const [created] = await db
      .insert(captures)
      .values({
        kind: "text",
        rawText: row.rawText,
        dedupeKey: row.dedupeKey,
        metadata: metadataWithMarker,
      })
      .returning({ id: captures.id });
    if (!created) throw new Error("upsertImportedCapture: insert returned no row");
    return { id: created.id, action: "inserted" };
  }

  const prevMarker =
    typeof existing.metadata === "object" && existing.metadata !== null
      ? (existing.metadata as Record<string, unknown>)[MARKER_META_KEY]
      : undefined;
  if (prevMarker === marker) {
    return { id: existing.id, action: "unchanged" };
  }

  // Content changed: replace rawText, drop old enrichment, reset status so
  // the worker re-enriches from scratch.
  await db.delete(enrichments).where(eq(enrichments.captureId, existing.id));
  await db
    .update(captures)
    .set({
      rawText: row.rawText,
      status: "pending",
      metadata: metadataWithMarker,
      updatedAt: new Date(),
    })
    .where(eq(captures.id, existing.id));
  return { id: existing.id, action: "updated" };
}
