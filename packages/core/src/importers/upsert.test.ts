import { describe, expect, it } from "vitest";
import { upsertImportedCapture } from "./upsert.js";

/**
 * Stub of the drizzle query interface. We track calls + state instead of
 * standing up Postgres.
 *
 * The stub identifies WHICH lookup is happening from the call order:
 *   1. select().from(captures).where(eq(dedupeKey, key)) — find existing
 *   2. delete(enrichments).where(eq(captureId, id))     — clear enrichment
 *   3. update(captures).set(...).where(eq(captures.id, id)) — apply update
 *   4. insert(captures).values(...).returning()         — new capture
 */
function makeFakeDb(initialDedupeKey?: string) {
  const calls = { inserted: 0, updated: 0, deletedEnrichments: 0 };
  let stored: { id: string; metadata: Record<string, unknown>; rawText: string } | null = null;

  const db = {
    select() {
      return {
        from: () => ({
          where: () =>
            stored && stored.metadata._matchedDedupeKey === initialDedupeKey
              ? [{ id: stored.id, metadata: stored.metadata }]
              : [],
        }),
      };
    },
    insert() {
      return {
        values: (v: { rawText: string; dedupeKey: string; metadata: Record<string, unknown> }) => ({
          returning: () => {
            calls.inserted += 1;
            stored = {
              id: "cap-1",
              rawText: v.rawText,
              metadata: { ...v.metadata, _matchedDedupeKey: v.dedupeKey },
            };
            return [{ id: "cap-1" }];
          },
        }),
      };
    },
    update() {
      return {
        set: (v: { rawText?: string; metadata?: Record<string, unknown> }) => ({
          where: () => {
            calls.updated += 1;
            if (stored && v.rawText !== undefined) stored.rawText = v.rawText;
            if (stored && v.metadata !== undefined) {
              stored.metadata = { ...v.metadata, _matchedDedupeKey: stored.metadata._matchedDedupeKey };
            }
          },
        }),
      };
    },
    delete() {
      return {
        where: () => {
          calls.deletedEnrichments += 1;
        },
      };
    },
  };

  return { db, calls, getStored: () => stored };
}

describe("upsertImportedCapture", () => {
  it("inserts when no existing capture", async () => {
    const { db, calls } = makeFakeDb("logseq:pages/A.md");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await upsertImportedCapture(db as any, {
      dedupeKey: "logseq:pages/A.md",
      rawText: "hello",
      metadata: { importSource: "logseq" },
    });
    expect(result.action).toBe("inserted");
    expect(calls.inserted).toBe(1);
    expect(calls.updated).toBe(0);
    expect(calls.deletedEnrichments).toBe(0);
  });

  it("returns unchanged when re-importing identical content", async () => {
    const { db, calls } = makeFakeDb("logseq:pages/A.md");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await upsertImportedCapture(db as any, {
      dedupeKey: "logseq:pages/A.md",
      rawText: "hello",
      metadata: { importSource: "logseq" },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const second = await upsertImportedCapture(db as any, {
      dedupeKey: "logseq:pages/A.md",
      rawText: "hello",
      metadata: { importSource: "logseq" },
    });
    expect(second.action).toBe("unchanged");
    expect(calls.updated).toBe(0);
    expect(calls.deletedEnrichments).toBe(0);
  });

  it("updates and clears enrichment when content changes", async () => {
    const { db, calls } = makeFakeDb("logseq:pages/A.md");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await upsertImportedCapture(db as any, {
      dedupeKey: "logseq:pages/A.md",
      rawText: "hello",
      metadata: { importSource: "logseq" },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const second = await upsertImportedCapture(db as any, {
      dedupeKey: "logseq:pages/A.md",
      rawText: "hello (edited)",
      metadata: { importSource: "logseq" },
    });
    expect(second.action).toBe("updated");
    expect(calls.updated).toBe(1);
    expect(calls.deletedEnrichments).toBe(1);
  });

  it("uses explicit changeMarker over hash (Notion lastEditedAt path)", async () => {
    const { db } = makeFakeDb("notion:abc");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await upsertImportedCapture(db as any, {
      dedupeKey: "notion:abc",
      rawText: "page body v1",
      metadata: { importSource: "notion" },
      changeMarker: "2026-05-01T00:00:00Z",
    });
    // Body changed but Notion marker is the same → still unchanged.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const second = await upsertImportedCapture(db as any, {
      dedupeKey: "notion:abc",
      rawText: "page body v2 (drift)",
      metadata: { importSource: "notion" },
      changeMarker: "2026-05-01T00:00:00Z",
    });
    expect(second.action).toBe("unchanged");
  });
});
