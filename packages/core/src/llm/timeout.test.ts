import { describe, expect, it } from "vitest";
import { createTimeoutSignal } from "./timeout.js";

describe("createTimeoutSignal", () => {
  it("signal starts unaborted", () => {
    const { signal, cleanup } = createTimeoutSignal(10_000, "openai");
    expect(signal.aborted).toBe(false);
    cleanup();
  });

  it("cleanup prevents the timer from firing", async () => {
    const { signal, cleanup } = createTimeoutSignal(30, "openai");
    cleanup();
    await new Promise((r) => setTimeout(r, 60));
    expect(signal.aborted).toBe(false);
  });

  it("signal aborts after the deadline if cleanup is not called", async () => {
    const { signal } = createTimeoutSignal(30, "anthropic");
    await new Promise((r) => setTimeout(r, 60));
    expect(signal.aborted).toBe(true);
  });
});
