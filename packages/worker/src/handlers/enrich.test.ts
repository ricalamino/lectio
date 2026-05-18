import { describe, expect, it, vi } from "vitest";
import { handleEnrich } from "./enrich.js";
import type { EnrichDeps } from "./enrich.js";
import type { LlmProvider } from "@lectio/core/llm";
import { captureAddendums, captures, enrichments } from "@lectio/core/db/schema";

// ---- Minimal DB stub -------------------------------------------------------

type CaptureRow = ReturnType<typeof makeCapture>;
type AddendumRow = { id: string; body: string; createdAt: Date };
type EnrichmentRow = {
  id: string;
  captureId: string;
  version: number;
  isCurrent: boolean;
};

function makeCapture(overrides: Partial<{
  id: string;
  kind: string;
  status: string;
  rawText: string | null;
  mediaKey: string | null;
  metadata: Record<string, unknown>;
  updatedAt: Date;
}> = {}) {
  return {
    id: "cap-1",
    kind: "text",
    status: "pending",
    rawText: "some raw text",
    sourceUrl: null,
    mediaKey: null,
    metadata: {} as Record<string, unknown>,
    capturedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    dedupeKey: null,
    ...overrides,
  };
}

interface DbState {
  capture: CaptureRow | null;
  addendums: AddendumRow[];
  enrichments: EnrichmentRow[];
  updates: Array<Record<string, unknown>>;
  enrichmentInserts: Array<Record<string, unknown>>;
  captureUpdates: Array<Record<string, unknown>>;
  enrichmentUpdates: Array<Record<string, unknown>>;
}

// Routes a select() call to one of the tracked tables based on which schema
// object was passed to .from(). Keeps tests robust to call-order changes.
function makeSelectChain(state: DbState) {
  let table: unknown = null;
  const chain = {
    from(t: unknown) {
      table = t;
      return chain;
    },
    where() {
      return chain;
    },
    orderBy() {
      return chain;
    },
    limit() {
      return Promise.resolve(rowsForTable());
    },
    then(resolve: (rows: unknown[]) => unknown) {
      return Promise.resolve(rowsForTable()).then(resolve);
    },
  } as {
    from: (t: unknown) => typeof chain;
    where: () => typeof chain;
    orderBy: () => typeof chain;
    limit: () => Promise<unknown[]>;
    then: (resolve: (rows: unknown[]) => unknown) => Promise<unknown>;
    [Symbol.iterator]?: () => Iterator<unknown>;
  };

  function rowsForTable(): unknown[] {
    if (table === captures) return state.capture ? [state.capture] : [];
    if (table === captureAddendums) return state.addendums;
    if (table === enrichments) {
      // Both the idempotency probe and the max-version probe hit this table;
      // returning all current rows satisfies both, since the handler only
      // looks at .length and .version of the first element.
      const sorted = [...state.enrichments].sort((a, b) => b.version - a.version);
      return sorted;
    }
    return [];
  }

  return chain;
}

function makeDbApi(state: DbState) {
  function makeUpdateChain(target: unknown) {
    return {
      set(values: Record<string, unknown>) {
        return {
          where() {
            state.updates.push({ table: target, ...values });
            if (target === captures) {
              state.captureUpdates.push(values);
              if (state.capture && values.status) {
                state.capture.status = values.status as string;
              }
              if (state.capture && values.metadata) {
                state.capture.metadata = values.metadata as Record<string, unknown>;
              }
              if (state.capture && values.rawText !== undefined) {
                state.capture.rawText = values.rawText as string | null;
              }
            }
            if (target === enrichments) {
              state.enrichmentUpdates.push(values);
              if (values.isCurrent === false) {
                for (const e of state.enrichments) e.isCurrent = false;
              }
            }
          },
        };
      },
    };
  }

  return {
    select: () => makeSelectChain(state),
    update: (table: unknown) => makeUpdateChain(table),
    insert: (table: unknown) => ({
      values(values: Record<string, unknown>) {
        if (table === enrichments) {
          state.enrichmentInserts.push(values);
          state.enrichments.push({
            id: `enr-${state.enrichments.length + 1}`,
            captureId: values.captureId as string,
            version: (values.version as number) ?? 1,
            isCurrent: (values.isCurrent as boolean) ?? true,
          });
        }
        return Promise.resolve();
      },
    }),
    transaction: async (fn: (tx: ReturnType<typeof makeDbApi>) => Promise<void>) => {
      // No real transaction in tests — just call through with the same API.
      await fn(makeDbApi(state));
    },
  };
}

function makeDb(capture: CaptureRow | null, addendums: AddendumRow[] = []) {
  const state: DbState = {
    capture,
    addendums,
    enrichments: [],
    updates: [],
    enrichmentInserts: [],
    captureUpdates: [],
    enrichmentUpdates: [],
  };
  const db = makeDbApi(state);
  return { db, state };
}

// ---- LLM stub ---------------------------------------------------------------

function makeLlm(overrides: Partial<LlmProvider> = {}): LlmProvider {
  return {
    name: "openai",
    complete: vi.fn().mockResolvedValue({ text: "", tokensIn: 0, tokensOut: 0, model: "gpt-4o", provider: "openai" }),
    completeStream: async function* () { yield ""; },
    completeJson: vi.fn().mockResolvedValue({
      data: {
        title: "Test Title",
        summary: "Test summary",
        tags: ["test"],
        entities: {},
        suggested_action: null,
        content_type: "idea",
      },
      raw: "{}",
      tokensIn: 10,
      tokensOut: 20,
      model: "gpt-4o",
      provider: "openai",
    }),
    embed: vi.fn().mockResolvedValue({ embeddings: [], model: "text-embedding-3-small", provider: "openai" }),
    ...overrides,
  };
}

function makeDeps(overrides: Partial<EnrichDeps> = {}): EnrichDeps {
  const { db } = makeDb(makeCapture());
  return {
    db: db as unknown as EnrichDeps["db"],
    llm: makeLlm(),
    embed: null,
    models: { enrich: "gpt-4o-mini" },
    embedDimensions: 1536,
    transcribe: null,
    vision: null,
    s3: null,
    enrichLlmMaxAttempts: 3,
    enrichLlmTimeoutMs: 120_000,
    enrichStaleMs: 600_000,
    ...overrides,
  };
}

// ---- Tests ------------------------------------------------------------------

describe("handleEnrich", () => {
  it("sets status to enriched on success", async () => {
    const capture = makeCapture({ rawText: "hello world" });
    const { db, state } = makeDb(capture);
    const deps = makeDeps({ db: db as unknown as EnrichDeps["db"] });

    await handleEnrich({ captureId: "cap-1" }, deps);

    const finalStatus = state.captureUpdates.find((u) => u.status === "enriched");
    expect(finalStatus).toBeDefined();
  });

  it("writes the initial enrichment as version 1 / is_current = true", async () => {
    const capture = makeCapture({ rawText: "hello world" });
    const { db, state } = makeDb(capture);
    const deps = makeDeps({ db: db as unknown as EnrichDeps["db"] });

    await handleEnrich({ captureId: "cap-1" }, deps);

    expect(state.enrichmentInserts).toHaveLength(1);
    expect(state.enrichmentInserts[0]?.version).toBe(1);
    expect(state.enrichmentInserts[0]?.isCurrent).toBe(true);
  });

  it("returns early when capture not found", async () => {
    const { db } = makeDb(null);
    const llm = makeLlm();
    const deps = makeDeps({ db: db as unknown as EnrichDeps["db"], llm });

    await handleEnrich({ captureId: "missing" }, deps);

    expect(llm.completeJson).not.toHaveBeenCalled();
  });

  it("sets status to failed when rawText is empty and no media", async () => {
    const capture = makeCapture({ rawText: null, mediaKey: null });
    const { db, state } = makeDb(capture);
    const deps = makeDeps({ db: db as unknown as EnrichDeps["db"] });

    await handleEnrich({ captureId: "cap-1" }, deps);

    const failUpdate = state.captureUpdates.find((u) => u.status === "failed");
    expect(failUpdate).toBeDefined();
    expect((failUpdate?.metadata as Record<string, unknown>)?.enrichError).toBe("empty_content");
  });

  it("generates embedding when embed provider is set", async () => {
    const capture = makeCapture({ rawText: "hello" });
    const { db, state } = makeDb(capture);
    const embed = makeLlm({
      name: "openai",
      embed: vi.fn().mockResolvedValue({
        embeddings: [new Array(1536).fill(0.1)],
        model: "text-embedding-3-small",
        provider: "openai",
      }),
    });
    const deps = makeDeps({
      db: db as unknown as EnrichDeps["db"],
      embed,
      models: { enrich: "gpt-4o-mini", embed: "text-embedding-3-small" },
    });

    await handleEnrich({ captureId: "cap-1" }, deps);

    const insert = state.enrichmentInserts[0];
    expect(Array.isArray(insert?.embedding)).toBe(true);
    expect((insert?.embedding as number[]).length).toBe(1536);
  });

  it("skips embedding when dimension does not match schema", async () => {
    const capture = makeCapture({ rawText: "hello" });
    const { db, state } = makeDb(capture);
    const embed = makeLlm({
      embed: vi.fn().mockResolvedValue({
        embeddings: [new Array(768).fill(0.1)], // wrong dimension
        model: "nomic-embed-text",
        provider: "ollama",
      }),
    });
    const deps = makeDeps({
      db: db as unknown as EnrichDeps["db"],
      embed,
      models: { enrich: "gpt-4o-mini", embed: "nomic-embed-text" },
    });

    await handleEnrich({ captureId: "cap-1" }, deps);

    expect(state.enrichmentInserts[0]?.embedding).toBeNull();
  });

  it("sets status to failed and does not rethrow non-retryable LLM errors", async () => {
    const { LlmError } = await import("@lectio/core/llm");
    const capture = makeCapture({ rawText: "hello" });
    const { db, state } = makeDb(capture);
    const llm = makeLlm({
      completeJson: vi.fn().mockRejectedValue(
        new LlmError("auth failed", { provider: "openai", kind: "auth", retryable: false }),
      ),
    });
    const deps = makeDeps({ db: db as unknown as EnrichDeps["db"], llm });

    await expect(handleEnrich({ captureId: "cap-1" }, deps)).resolves.toBe(false);

    const failUpdate = state.captureUpdates.find((u) => u.status === "failed");
    expect(failUpdate).toBeDefined();
  });

  it("rethrows retryable LLM errors", async () => {
    const { LlmError } = await import("@lectio/core/llm");
    const capture = makeCapture({ rawText: "hello" });
    const { db } = makeDb(capture);
    const llm = makeLlm({
      completeJson: vi.fn().mockRejectedValue(
        new LlmError("rate limited", { provider: "openai", kind: "rate_limit", retryable: true }),
      ),
    });
    const deps = makeDeps({ db: db as unknown as EnrichDeps["db"], llm });

    await expect(handleEnrich({ captureId: "cap-1" }, deps)).rejects.toBeInstanceOf(LlmError);
  });

  it("does not call the LLM when the attempt budget is exhausted", async () => {
    const capture = makeCapture({
      rawText: "hello",
      metadata: { enrichLlmAttempts: 3 },
    });
    const { db, state } = makeDb(capture);
    const llm = makeLlm();
    const deps = makeDeps({
      db: db as unknown as EnrichDeps["db"],
      llm,
      enrichLlmMaxAttempts: 3,
    });

    await handleEnrich({ captureId: "cap-1" }, deps);

    expect(llm.completeJson).not.toHaveBeenCalled();
    const failUpdate = state.captureUpdates.find((u) => u.status === "failed");
    expect((failUpdate?.metadata as Record<string, unknown>)?.enrichError).toBe("llm_attempts_exceeded");
  });

  it("fails stale enriching captures without calling the LLM", async () => {
    const capture = makeCapture({
      rawText: "hello",
      status: "enriching",
      updatedAt: new Date(Date.now() - 3_600_000),
    });
    const { db, state } = makeDb(capture);
    const llm = makeLlm();
    const deps = makeDeps({
      db: db as unknown as EnrichDeps["db"],
      llm,
      enrichStaleMs: 600_000,
    });

    await handleEnrich({ captureId: "cap-1" }, deps);

    expect(llm.completeJson).not.toHaveBeenCalled();
    const failUpdate = state.captureUpdates.find((u) => u.status === "failed");
    expect((failUpdate?.metadata as Record<string, unknown>)?.enrichError).toBe("enrich_stale");
  });

  it("includes addendums in the user message and bumps version to N+1", async () => {
    const capture = makeCapture({ rawText: "hello" });
    const addendums: AddendumRow[] = [
      { id: "a1", body: "more context here", createdAt: new Date("2026-05-18T14:32:00Z") },
      { id: "a2", body: "yet another note", createdAt: new Date("2026-05-18T15:01:00Z") },
    ];
    const { db, state } = makeDb(capture, addendums);
    // Seed an existing enrichment so the new one becomes version 2.
    state.enrichments.push({ id: "e0", captureId: "cap-1", version: 1, isCurrent: true });
    const llm = makeLlm();
    const deps = makeDeps({ db: db as unknown as EnrichDeps["db"], llm });

    await handleEnrich({ captureId: "cap-1" }, deps);

    const call = (llm.completeJson as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
      messages: { role: string; content: string }[];
    };
    const userMessage = call.messages.find((m) => m.role === "user")?.content ?? "";
    expect(userMessage).toContain("more context here");
    expect(userMessage).toContain("yet another note");
    expect(userMessage).toContain("Addendum");

    // The new enrichment was written with version 2 and the old one was demoted.
    const newest = state.enrichmentInserts[0];
    expect(newest?.version).toBe(2);
    expect(newest?.isCurrent).toBe(true);
    expect(state.enrichmentUpdates.some((u) => u.isCurrent === false)).toBe(true);
  });

  it("skips re-enrichment when capture is already enriched and a current enrichment exists", async () => {
    const capture = makeCapture({ rawText: "hello", status: "enriched" });
    const { db, state } = makeDb(capture);
    state.enrichments.push({ id: "e0", captureId: "cap-1", version: 1, isCurrent: true });
    const llm = makeLlm();
    const deps = makeDeps({ db: db as unknown as EnrichDeps["db"], llm });

    const result = await handleEnrich({ captureId: "cap-1" }, deps);

    expect(result).toBe(false);
    expect(llm.completeJson).not.toHaveBeenCalled();
    expect(state.enrichmentInserts).toEqual([]);
  });
});
