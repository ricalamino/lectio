import Anthropic from "@anthropic-ai/sdk";
import type {
  CompleteJsonOptions,
  CompleteOptions,
  CompletionResult,
  EmbedOptions,
  EmbeddingResult,
  JsonResult,
  LlmMessage,
  LlmProvider,
} from "./types.js";
import { LlmError } from "./types.js";

interface AnthropicConfig {
  apiKey: string;
  baseUrl?: string;
}

export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic" as const;
  private readonly client: Anthropic;

  constructor(config: AnthropicConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }

  async complete(options: CompleteOptions): Promise<CompletionResult> {
    const { system, messages } = splitSystem(options.messages);
    try {
      const response = await this.client.messages.create({
        model: options.model,
        max_tokens: options.maxTokens ?? 1024,
        temperature: options.temperature,
        system,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });
      const text = response.content
        .map((block) => (block.type === "text" ? block.text : ""))
        .join("");
      return {
        text,
        tokensIn: response.usage.input_tokens,
        tokensOut: response.usage.output_tokens,
        model: response.model,
        provider: this.name,
      };
    } catch (err) {
      throw wrap(err);
    }
  }

  async completeJson<T>(options: CompleteJsonOptions<T>): Promise<JsonResult<T>> {
    const result = await this.complete({
      ...options,
      messages: [
        ...options.messages,
        {
          role: "user",
          content:
            "Respond with a single JSON object only. No prose, no markdown fences.",
        },
      ],
    });
    const trimmed = stripFences(result.text);
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (err) {
      throw new LlmError("Anthropic returned non-JSON output", {
        provider: this.name,
        kind: "parse",
        retryable: true,
        cause: err,
      });
    }
    const validated = options.schema.safeParse(parsed);
    if (!validated.success) {
      throw new LlmError("Anthropic JSON failed schema validation", {
        provider: this.name,
        kind: "parse",
        retryable: true,
        cause: validated.error,
      });
    }
    return {
      data: validated.data,
      raw: result.text,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      model: result.model,
      provider: this.name,
    };
  }

  async embed(_options: EmbedOptions): Promise<EmbeddingResult> {
    throw new LlmError("Anthropic does not provide an embeddings endpoint", {
      provider: this.name,
      kind: "unknown",
      retryable: false,
    });
  }
}

interface NonSystemMessage {
  role: "user" | "assistant";
  content: string;
}

function splitSystem(messages: LlmMessage[]): {
  system: string | undefined;
  messages: NonSystemMessage[];
} {
  const systemParts: string[] = [];
  const rest: NonSystemMessage[] = [];
  for (const m of messages) {
    if (m.role === "system") {
      systemParts.push(m.content);
    } else {
      rest.push({ role: m.role, content: m.content });
    }
  }
  return {
    system: systemParts.length > 0 ? systemParts.join("\n\n") : undefined,
    messages: rest,
  };
}

function stripFences(text: string): string {
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text.trim());
  return fence?.[1] ?? text.trim();
}

function wrap(err: unknown): LlmError {
  if (err instanceof Anthropic.APIError) {
    const status = err.status ?? 0;
    const kind =
      status === 401 || status === 403
        ? "auth"
        : status === 429
          ? "rate_limit"
          : status >= 500
            ? "unknown"
            : "unknown";
    const retryable = status === 429 || status >= 500;
    return new LlmError(`Anthropic API error: ${err.message}`, {
      provider: "anthropic",
      kind,
      retryable,
      cause: err,
    });
  }
  return new LlmError("Anthropic unknown error", {
    provider: "anthropic",
    kind: "unknown",
    retryable: true,
    cause: err,
  });
}
