import { describe, expect, it, vi } from "vitest";
import { handleConnect } from "./connect.js";
import type { ConnectDeps } from "./connect.js";
import type { LlmProvider } from "@lectio/core/llm";

// ---- DB stub ----------------------------------------------------------------

interface FakeEnrichmentRow {
  id: string;
  rawText: string | null;
  capturedAt: Date;
  title: string;
  summary: string;
  tags: string[];
  embedding: number[] | null;
}

interface FakeConnectionInsert {
  fromCaptureId: string;
  toCaptureId: string;
  kind: string;
  reason: string;
  confidence: string;
  score: number;
}

function makeEnrichmentRow(overrides: Partial<FakeEnrichmentRow> = {}): FakeEnrichmentRow {
  return {
    id: "cap-old",
    rawText: "prior content",
    capturedAt: new Date("2026-01-01"),
    title: "Prior capture",
    summary: "Summary of prior",
    tags: ["test"],
    embedding: new Array(1536).fill(0.5),
    ...overrides,
  };
}

function chainable(returnValue: unknown) {
  const c: Record<string, () => unknown> = {};
  const methods = ["from", "innerJoin", "where", "orderBy", "limit", "leftJoin"];
  for (const m of methods) {
    c[m] = () => chainable(returnValue);
  }
  // Terminal: awaiting the chain (Drizzle queries are thenable/array-like)
  (c as unknown as Promise<unknown> & { then: unknown }).then = (
    resolve: (v: unknown) => unknown,
  ) => Promise.resolve(returnValue).then(resolve);
  // Make it iterable / spread-able via Symbol.iterator isn't needed since
  // handlers do `await db.select()...` — the `.then` above handles it, but
  // Drizzle returns real arrays so we need to handle the common destructuring
  // pattern `const [row] = await ...`.
  return c;
}

function makeConnectDb(opts: {
  targetCapture?: FakeEnrichmentRow | null;
  candidates?: FakeEnrichmentRow[];
}) {
  const inserts: FakeConnectionInsert[] = [];
  let selectCallIndex = 0;

  const defaultTarget = makeEnrichmentRow({
    id: "cap-new",
    capturedAt: new Date("2026-05-01"),
    embedding: new Array(1536).fill(0.9),
  });

  const candidateRows = (opts.candidates ?? [makeEnrichmentRow()]).map((c) => ({
    ...c,
    similarity: 0.85,
  }));

  const targetRow =
    opts.targetCapture !== undefined
      ? opts.targetCapture
        ? [opts.targetCapture]
        : []
      : [defaultTarget];

  const db = {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => {
            const idx = selectCallIndex++;
            const result = idx === 0 ? targetRow : candidateRows;
            return {
              orderBy: () => ({
                limit: () => result,
              }),
              // handle queries without orderBy (loadCapture uses .where directly)
              then: (resolve: (v: unknown) => unknown) =>
                Promise.resolve(result).then(resolve),
            };
          },
        }),
        where: () => {
          // loadCapture path (no innerJoin)
          const idx = selectCallIndex++;
          return idx === 0 ? targetRow : candidateRows;
        },
      }),
    }),
    insert: () => ({
      values: (v: FakeConnectionInsert) => ({
        onConflictDoNothing: () => {
          inserts.push(v);
        },
      }),
    }),
  };

  return { db, inserts };
}

// ---- LLM stub ----------------------------------------------------------------

function makeLlm(overrides: Partial<LlmProvider> = {}): LlmProvider {
  return {
    name: "openai",
    complete: vi.fn(),
    completeStream: async function* () { yield ""; },
    completeJson: vi.fn().mockResolvedValue({
      data: [
        {
          capture_id: "cap-old",
          verdict: "connect",
          type: "continuation",
          reason: "B follows up on A",
          confidence: "high",
        },
      ],
      raw: "[]",
      tokensIn: 50,
      tokensOut: 100,
      model: "gpt-4o-mini",
      provider: "openai",
    }),
    embed: vi.fn(),
    ...overrides,
  };
}

function makeDeps(overrides: Partial<ConnectDeps> = {}): ConnectDeps {
  const { db } = makeConnectDb({});
  return {
    db: db as unknown as ConnectDeps["db"],
    llm: makeLlm(),
    model: "gpt-4o-mini",
    candidateLimit: 8,
    ...overrides,
  };
}

// ---- Tests ------------------------------------------------------------------

describe("handleConnect", () => {
  it("returns early when capture not found", async () => {
    const { db } = makeConnectDb({ targetCapture: null });
    const llm = makeLlm();
    const deps = makeDeps({ db: db as unknown as ConnectDeps["db"], llm });

    await handleConnect({ captureId: "missing" }, deps);

    expect(llm.completeJson).not.toHaveBeenCalled();
  });

  it("inserts a connection when LLM returns connect+high", async () => {
    const { db, inserts } = makeConnectDb({});
    const deps = makeDeps({ db: db as unknown as ConnectDeps["db"] });

    await handleConnect({ captureId: "cap-new" }, deps);

    expect(inserts.length).toBeGreaterThanOrEqual(1);
    expect(inserts[0]?.kind).toBe("continuation");
    expect(inserts[0]?.confidence).toBe("high");
  });

  it("does not insert when LLM returns skip", async () => {
    const { db, inserts } = makeConnectDb({});
    const llm = makeLlm({
      completeJson: vi.fn().mockResolvedValue({
        data: [{ capture_id: "cap-old", verdict: "skip", type: null, reason: "unrelated", confidence: "low" }],
        raw: "[]",
        tokensIn: 20,
        tokensOut: 30,
        model: "gpt-4o-mini",
        provider: "openai",
      }),
    });
    const deps = makeDeps({ db: db as unknown as ConnectDeps["db"], llm });

    await handleConnect({ captureId: "cap-new" }, deps);

    expect(inserts.length).toBe(0);
  });

  it("does not insert when confidence is low", async () => {
    const { db, inserts } = makeConnectDb({});
    const llm = makeLlm({
      completeJson: vi.fn().mockResolvedValue({
        data: [{ capture_id: "cap-old", verdict: "connect", type: "pattern", reason: "maybe", confidence: "low" }],
        raw: "[]",
        tokensIn: 20,
        tokensOut: 30,
        model: "gpt-4o-mini",
        provider: "openai",
      }),
    });
    const deps = makeDeps({ db: db as unknown as ConnectDeps["db"], llm });

    await handleConnect({ captureId: "cap-new" }, deps);

    expect(inserts.length).toBe(0);
  });

  it("sends a single batch LLM call regardless of candidate count", async () => {
    const candidates = [
      makeEnrichmentRow({ id: "c1", capturedAt: new Date("2026-01-01") }),
      makeEnrichmentRow({ id: "c2", capturedAt: new Date("2026-01-02") }),
      makeEnrichmentRow({ id: "c3", capturedAt: new Date("2026-01-03") }),
    ];
    const { db } = makeConnectDb({ candidates });
    const llm = makeLlm({
      completeJson: vi.fn().mockResolvedValue({
        data: candidates.map((c) => ({
          capture_id: c.id,
          verdict: "skip",
          type: null,
          reason: "no",
          confidence: "low",
        })),
        raw: "[]",
        tokensIn: 80,
        tokensOut: 100,
        model: "gpt-4o-mini",
        provider: "openai",
      }),
    });
    const deps = makeDeps({ db: db as unknown as ConnectDeps["db"], llm });

    await handleConnect({ captureId: "cap-new" }, deps);

    // Exactly one LLM call for all candidates combined
    expect(llm.completeJson).toHaveBeenCalledTimes(1);
  });
});
