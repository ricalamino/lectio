import { AnthropicProvider } from "./anthropic.js";
import { OllamaProvider } from "./ollama.js";
import { OpenAIProvider } from "./openai.js";
import { googleStub, openaiCompatibleStub, openrouterStub } from "./stubs.js";
import type { LlmProvider, LlmProviderName } from "./types.js";

export interface ProviderEnv {
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  OLLAMA_BASE_URL?: string;
  OPENAI_COMPATIBLE_BASE_URL?: string;
  OPENAI_COMPATIBLE_API_KEY?: string;
}

export function createProvider(
  name: LlmProviderName,
  env: ProviderEnv = process.env as ProviderEnv,
): LlmProvider {
  switch (name) {
    case "anthropic": {
      const apiKey = env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
      return new AnthropicProvider({ apiKey });
    }
    case "openai": {
      const apiKey = env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
      return new OpenAIProvider({ apiKey });
    }
    case "google":
      return googleStub;
    case "ollama": {
      const baseUrl = env.OLLAMA_BASE_URL;
      if (!baseUrl) throw new Error("OLLAMA_BASE_URL is not set");
      return new OllamaProvider({ baseUrl });
    }
    case "openrouter":
      return openrouterStub;
    case "openai-compatible":
      return openaiCompatibleStub;
  }
}
