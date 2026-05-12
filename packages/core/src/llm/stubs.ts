import type { LlmProvider, LlmProviderName } from "./types.js";
import { LlmError } from "./types.js";

function notImplemented(name: LlmProviderName): LlmProvider {
  const fail = () => {
    throw new LlmError(`Provider '${name}' is not yet implemented`, {
      provider: name,
      kind: "unknown",
      retryable: false,
    });
  };
  return {
    name,
    complete: fail,
    completeJson: fail,
    embed: fail,
  };
}

export const googleStub = notImplemented("google");
export const openrouterStub = notImplemented("openrouter");
export const openaiCompatibleStub = notImplemented("openai-compatible");
