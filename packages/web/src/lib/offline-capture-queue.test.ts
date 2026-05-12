import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  enqueuePendingCapture,
  isLikelyOfflineError,
  listPendingCaptures,
  removePendingCapture,
  replacePendingQueue,
} from "./offline-capture-queue";

const store: Record<string, string> = {};

beforeEach(() => {
  vi.stubGlobal("crypto", { randomUUID: () => "test-uuid-1" });
  Object.keys(store).forEach((k) => {
    delete store[k];
  });
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        Object.keys(store).forEach((k) => {
          delete store[k];
        });
      },
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("offline-capture-queue", () => {
  it("enqueues and lists pending captures", () => {
    enqueuePendingCapture({ kind: "text", rawText: "hello" });
    const q = listPendingCaptures();
    expect(q).toHaveLength(1);
    expect(q[0]?.payload.rawText).toBe("hello");
    expect(q[0]?.id).toBe("test-uuid-1");
  });

  it("removes by id", () => {
    enqueuePendingCapture({ kind: "text", rawText: "a" });
    const id = listPendingCaptures()[0]!.id;
    removePendingCapture(id);
    expect(listPendingCaptures()).toHaveLength(0);
  });

  it("replacePendingQueue overwrites storage", () => {
    enqueuePendingCapture({ kind: "text", rawText: "x" });
    replacePendingQueue([]);
    expect(listPendingCaptures()).toHaveLength(0);
  });

  it("detects network-like TypeError", () => {
    expect(isLikelyOfflineError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isLikelyOfflineError(new Error("400"))).toBe(false);
  });
});
