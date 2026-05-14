import type { LlmProviderName } from "./types.js";
import { LlmError } from "./types.js";

export const DEFAULT_LLM_TIMEOUT_MS = 120_000;

/**
 * Returns an AbortSignal that triggers after `timeoutMs` and a cleanup
 * function that cancels the internal timer (call it in `finally`).
 *
 * Using AbortSignal instead of Promise.race ensures the underlying HTTP
 * request is actually cancelled by the SDK, stopping token consumption.
 */
export function createTimeoutSignal(
  timeoutMs: number,
  provider: LlmProviderName,
): { signal: AbortSignal; cleanup: () => void; onAbort: () => never } {
  const controller = new AbortController();
  const timer = setTimeout(
    () =>
      controller.abort(
        new LlmError(`LLM request exceeded ${timeoutMs}ms`, {
          provider,
          kind: "timeout",
          retryable: false,
        }),
      ),
    timeoutMs,
  );
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timer),
    onAbort: () => {
      const reason = controller.signal.reason;
      throw reason instanceof LlmError
        ? reason
        : new LlmError(`LLM request aborted`, { provider, kind: "timeout", retryable: false });
    },
  };
}
