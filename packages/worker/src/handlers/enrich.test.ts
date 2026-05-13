import { describe, expect, it, vi } from "vitest";
import { handleEnrich } from "./enrich.js";
import type { EnrichDeps } from "./enrich.js";
import type { LlmProvider } from "@lectio/core/llm";

// ---- Minimal DB stub -------------------------------------------------------

function makeCapture(overrides: Partial<{
  id: string;
  kind: string;
  status: string;
  rawText: string | null;
  mediaKey: string | null;
  metadata: Record<string, unknown>;
}> = {}) {
  return {
    id: "cap-1",
    kind: "text",
    status: "pending",
    rawText: "some raw text",
    sourceUrl: null,
    mediaKey: null,
    metadata: {},
    capturedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    dedupeKey: null,
    ...overrides,
  };
}

function makeDb(capture: ReturnType<typeof makeCapture> | null) {
  const updates: Array<Record<string, unknown>> = [];
  const inserts: Array<Record<string, unknown>> = [];

  const db = {
    select: () => ({
      from: () => ({
        where: () => (capture ? [capture] : []),
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: () => {
          updates.push(values);
          if (values.status && capture) {
            capture.status = values.status as string;
          }
        },
      }),
    }),
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        inserts.push(values);
      },
    }),
  };

  return { db, updates, inserts };
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
    ...overrides,
  };
}

// ---- Tests ------------------------------------------------------------------

describe("handleEnrich", () => {
  it("sets status to enriched on success", async () => {
    const capture = makeCapture({ rawText: "hello world" });
    const { db, updates } = makeDb(capture);
    const deps = makeDeps({ db: db as unknown as EnrichDeps["db"] });

    await handleEnrich({ captureId: "cap-1" }, deps);

    const finalStatus = updates.find((u) => u.status === "enriched");
    expect(finalStatus).toBeDefined();
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
    const { db, updates } = makeDb(capture);
    const deps = makeDeps({ db: db as unknown as EnrichDeps["db"] });

    await handleEnrich({ captureId: "cap-1" }, deps);

    const failUpdate = updates.find((u) => u.status === "failed");
    expect(failUpdate).toBeDefined();
    expect((failUpdate?.metadata as Record<string, unknown>)?.enrichError).toBe("empty_content");
  });

  it("generates embedding when embed provider is set", async () => {
    const capture = makeCapture({ rawText: "hello" });
    const { db, inserts } = makeDb(capture);
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

    const enrichmentInsert = inserts[0] as Record<string, unknown> | undefined;
    expect(Array.isArray(enrichmentInsert?.embedding)).toBe(true);
    expect((enrichmentInsert?.embedding as number[]).length).toBe(1536);
  });

  it("skips embedding when dimension does not match schema", async () => {
    const capture = makeCapture({ rawText: "hello" });
    const { db, inserts } = makeDb(capture);
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

    const enrichmentInsert = inserts[0] as Record<string, unknown> | undefined;
    expect(enrichmentInsert?.embedding).toBeNull();
  });

  it("sets status to failed and does not rethrow non-retryable LLM errors", async () => {
    const { LlmError } = await import("@lectio/core/llm");
    const capture = makeCapture({ rawText: "hello" });
    const { db, updates } = makeDb(capture);
    const llm = makeLlm({
      completeJson: vi.fn().mockRejectedValue(
        new LlmError("auth failed", { provider: "openai", kind: "auth", retryable: false }),
      ),
    });
    const deps = makeDeps({ db: db as unknown as EnrichDeps["db"], llm });

    await expect(handleEnrich({ captureId: "cap-1" }, deps)).resolves.toBeUndefined();

    const failUpdate = updates.find((u) => u.status === "failed");
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
});
