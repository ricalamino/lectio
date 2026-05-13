import OpenAI from "openai";
import type {
  CompleteJsonOptions,
  CompleteOptions,
  CompletionResult,
  EmbedOptions,
  EmbeddingResult,
  JsonResult,
  LlmProvider,
} from "./types.js";
import { LlmError } from "./types.js";

interface OpenAIConfig {
  apiKey: string;
  baseUrl?: string;
}

export class OpenAIProvider implements LlmProvider {
  readonly name = "openai" as const;
  private readonly client: OpenAI;

  constructor(config: OpenAIConfig) {
    this.client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl });
  }

  async complete(options: CompleteOptions): Promise<CompletionResult> {
    try {
      const response = await this.client.chat.completions.create({
        model: options.model,
        max_tokens: options.maxTokens,
        temperature: options.temperature,
        messages: options.messages.map((m) => ({ role: m.role, content: m.content })),
      });
      const choice = response.choices[0];
      const text = choice?.message?.content ?? "";
      return {
        text,
        tokensIn: response.usage?.prompt_tokens ?? 0,
        tokensOut: response.usage?.completion_tokens ?? 0,
        model: response.model,
        provider: this.name,
      };
    } catch (err) {
      throw wrap(err);
    }
  }

  async *completeStream(options: CompleteOptions): AsyncIterable<string> {
    try {
      const stream = await this.client.chat.completions.create({
        model: options.model,
        max_tokens: options.maxTokens,
        temperature: options.temperature,
        stream: true,
        messages: options.messages.map((m) => ({ role: m.role, content: m.content })),
      });
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? "";
        if (text) yield text;
      }
    } catch (err) {
      throw wrap(err);
    }
  }

  async completeJson<T>(options: CompleteJsonOptions<T>): Promise<JsonResult<T>> {
    try {
      const response = await this.client.chat.completions.create({
        model: options.model,
        max_tokens: options.maxTokens,
        temperature: options.temperature,
        response_format: { type: "json_object" },
        messages: options.messages.map((m) => ({ role: m.role, content: m.content })),
      });
      const choice = response.choices[0];
      const raw = choice?.message?.content ?? "";
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        throw new LlmError("OpenAI returned non-JSON output", {
          provider: this.name,
          kind: "parse",
          retryable: true,
          cause: err,
        });
      }
      const validated = options.schema.safeParse(parsed);
      if (!validated.success) {
        throw new LlmError("OpenAI JSON failed schema validation", {
          provider: this.name,
          kind: "parse",
          retryable: true,
          cause: validated.error,
        });
      }
      return {
        data: validated.data,
        raw,
        tokensIn: response.usage?.prompt_tokens ?? 0,
        tokensOut: response.usage?.completion_tokens ?? 0,
        model: response.model,
        provider: this.name,
      };
    } catch (err) {
      if (err instanceof LlmError) throw err;
      throw wrap(err);
    }
  }

  async embed(options: EmbedOptions): Promise<EmbeddingResult> {
    try {
      const response = await this.client.embeddings.create({
        model: options.model,
        input: options.input,
      });
      return {
        embeddings: response.data.map((d) => d.embedding),
        model: response.model,
        provider: this.name,
      };
    } catch (err) {
      throw wrap(err);
    }
  }
}

function wrap(err: unknown): LlmError {
  if (err instanceof OpenAI.APIError) {
    const status = err.status ?? 0;
    const kind =
      status === 401 || status === 403
        ? "auth"
        : status === 429
          ? "rate_limit"
          : "unknown";
    const retryable = status === 429 || status >= 500;
    return new LlmError(`OpenAI API error: ${err.message}`, {
      provider: "openai",
      kind,
      retryable,
      cause: err,
    });
  }
  return new LlmError("OpenAI unknown error", {
    provider: "openai",
    kind: "unknown",
    retryable: true,
    cause: err,
  });
}
