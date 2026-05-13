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

const CHAT_TIMEOUT_MS = 180_000;
const EMBED_TIMEOUT_MS = 120_000;

function messageContentToString(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "object" && part !== null && "text" in part) {
          return String((part as { text?: string }).text ?? "");
        }
        return "";
      })
      .join("");
  }
  if (content !== null && typeof content === "object") {
    return JSON.stringify(content);
  }
  return "";
}

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, "");
  return `${b}${path.startsWith("/") ? path : `/${path}`}`;
}

interface OllamaConfig {
  baseUrl: string;
}

export class OllamaProvider implements LlmProvider {
  readonly name = "ollama" as const;
  private readonly baseUrl: string;

  constructor(config: OllamaConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
  }

  async complete(options: CompleteOptions): Promise<CompletionResult> {
    const res = await this.postJson(
      "/api/chat",
      {
        model: options.model,
        messages: options.messages.map((m) => ({ role: m.role, content: m.content })),
        stream: false,
        options: {
          temperature: options.temperature ?? 0.7,
          num_predict: options.maxTokens ?? 1024,
        },
      },
      CHAT_TIMEOUT_MS,
    );
    const message = res.message as { content?: unknown } | undefined;
    const text = messageContentToString(message?.content);
    return {
      text,
      tokensIn: typeof res.prompt_eval_count === "number" ? res.prompt_eval_count : 0,
      tokensOut: typeof res.eval_count === "number" ? res.eval_count : 0,
      model: typeof res.model === "string" ? res.model : options.model,
      provider: this.name,
    };
  }

  async *completeStream(options: CompleteOptions): AsyncIterable<string> {
    const url = joinUrl(this.baseUrl, "/api/chat");
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: options.model,
          messages: options.messages.map((m) => ({ role: m.role, content: m.content })),
          stream: true,
          options: {
            temperature: options.temperature ?? 0.7,
            num_predict: options.maxTokens ?? 1024,
          },
        }),
        signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
      });
    } catch (err) {
      throw new LlmError(`Ollama request failed: ${url}`, {
        provider: this.name,
        kind: "timeout",
        retryable: true,
        cause: err,
      });
    }
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      throw new LlmError(`Ollama HTTP ${res.status}: ${text.slice(0, 500)}`, {
        provider: this.name,
        kind: res.status === 401 || res.status === 403 ? "auth" : "unknown",
        retryable: res.status === 429 || res.status >= 500,
      });
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const obj = JSON.parse(trimmed) as { message?: { content?: string }; done?: boolean };
          const text = obj.message?.content ?? "";
          if (text) yield text;
        } catch {
          // skip malformed ndjson lines
        }
      }
    }
  }

  async completeJson<T>(options: CompleteJsonOptions<T>): Promise<JsonResult<T>> {
    const res = await this.postJson(
      "/api/chat",
      {
        model: options.model,
        messages: options.messages.map((m) => ({ role: m.role, content: m.content })),
        stream: false,
        format: "json",
        options: {
          temperature: options.temperature ?? 0,
          num_predict: options.maxTokens ?? 1024,
        },
      },
      CHAT_TIMEOUT_MS,
    );
    const message = res.message as { content?: unknown } | undefined;
    const raw = messageContentToString(message?.content) || JSON.stringify(res.message ?? {});
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new LlmError("Ollama returned non-JSON output", {
        provider: this.name,
        kind: "parse",
        retryable: true,
        cause: err,
      });
    }
    const validated = options.schema.safeParse(parsed);
    if (!validated.success) {
      throw new LlmError("Ollama JSON failed schema validation", {
        provider: this.name,
        kind: "parse",
        retryable: true,
        cause: validated.error,
      });
    }
    return {
      data: validated.data,
      raw,
      tokensIn: typeof res.prompt_eval_count === "number" ? res.prompt_eval_count : 0,
      tokensOut: typeof res.eval_count === "number" ? res.eval_count : 0,
      model: typeof res.model === "string" ? res.model : options.model,
      provider: this.name,
    };
  }

  async embed(options: EmbedOptions): Promise<EmbeddingResult> {
    const body =
      typeof options.input === "string"
        ? { model: options.model, input: options.input }
        : { model: options.model, input: options.input };
    const res = await this.postJson("/api/embed", body, EMBED_TIMEOUT_MS);

    if (Array.isArray(options.input)) {
      const embeddings = res.embeddings as number[][] | undefined;
      if (!embeddings || !Array.isArray(embeddings)) {
        throw new LlmError("Ollama embed response missing embeddings[]", {
          provider: this.name,
          kind: "parse",
          retryable: false,
        });
      }
      return {
        embeddings,
        model: typeof res.model === "string" ? res.model : options.model,
        provider: this.name,
      };
    }

    const single = res.embedding as number[] | undefined;
    if (!single || !Array.isArray(single)) {
      throw new LlmError("Ollama embed response missing embedding", {
        provider: this.name,
        kind: "parse",
        retryable: false,
      });
    }
    return {
      embeddings: [single],
      model: typeof res.model === "string" ? res.model : options.model,
      provider: this.name,
    };
  }

  private async postJson(path: string, body: unknown, timeoutMs: number): Promise<Record<string, unknown>> {
    const url = joinUrl(this.baseUrl, path);
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      throw new LlmError(`Ollama request failed: ${url}`, {
        provider: this.name,
        kind: "timeout",
        retryable: true,
        cause: err,
      });
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const retryable = res.status === 429 || res.status >= 500;
      throw new LlmError(`Ollama HTTP ${res.status}: ${text.slice(0, 500)}`, {
        provider: this.name,
        kind: res.status === 401 || res.status === 403 ? "auth" : "unknown",
        retryable,
      });
    }
    return (await res.json()) as Record<string, unknown>;
  }
}
