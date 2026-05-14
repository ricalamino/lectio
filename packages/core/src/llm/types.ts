import { z } from "zod";

export type LlmProviderName =
  | "anthropic"
  | "openai"
  | "google"
  | "ollama"
  | "openrouter"
  | "openai-compatible";

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompleteOptions {
  model: string;
  messages: LlmMessage[];
  maxTokens?: number;
  temperature?: number;
  /** Wall-clock cap for the provider request. Defaults per provider. */
  timeoutMs?: number;
}

export interface CompleteJsonOptions<T> extends CompleteOptions {
  schema: z.ZodType<T>;
}

export interface EmbedOptions {
  model: string;
  input: string | string[];
}

export interface CompletionResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
  model: string;
  provider: LlmProviderName;
}

export interface JsonResult<T> extends Omit<CompletionResult, "text"> {
  data: T;
  raw: string;
}

export interface EmbeddingResult {
  embeddings: number[][];
  model: string;
  provider: LlmProviderName;
}

export interface LlmProvider {
  readonly name: LlmProviderName;
  complete(options: CompleteOptions): Promise<CompletionResult>;
  /** Yields text deltas as they arrive. Resolves fully when the stream ends. */
  completeStream(options: CompleteOptions): AsyncIterable<string>;
  completeJson<T>(options: CompleteJsonOptions<T>): Promise<JsonResult<T>>;
  embed(options: EmbedOptions): Promise<EmbeddingResult>;
}

export class LlmError extends Error {
  constructor(
    message: string,
    readonly opts: {
      provider: LlmProviderName;
      kind: "rate_limit" | "timeout" | "parse" | "auth" | "unknown";
      retryable: boolean;
      cause?: unknown;
    },
  ) {
    super(message, { cause: opts.cause });
    this.name = "LlmError";
  }
}
