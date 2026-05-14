import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

type ProviderKey = "anthropic" | "openai" | "ollama";

interface SetupStatus {
  /** Which LLM providers have credentials configured. */
  providers: ProviderKey[];
  /** Whether the enrich provider is configured and has credentials. */
  enrichOk: boolean;
  /** Whether the search provider is configured and has credentials. */
  searchOk: boolean;
  /** Whether at least one embedding provider is configured. */
  embedOk: boolean;
  /** True if the app is usable (enrich + search both OK). */
  ready: boolean;
  /** Human-readable list of problems. */
  issues: string[];
}

const PROVIDER_LABEL: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  ollama: "OLLAMA_BASE_URL",
};

export async function GET(): Promise<NextResponse<SetupStatus>> {
  const config = env();
  const issues: string[] = [];

  const configured: ProviderKey[] = [];
  if (config.ANTHROPIC_API_KEY) configured.push("anthropic");
  if (config.OPENAI_API_KEY) configured.push("openai");
  if (config.OLLAMA_BASE_URL) configured.push("ollama");

  if (configured.length === 0) {
    issues.push(
      "No LLM provider configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or OLLAMA_BASE_URL.",
    );
  }

  const enrichProvider = config.LECTIO_ENRICH_PROVIDER;
  const searchProvider = config.LECTIO_SEARCH_PROVIDER;

  const enrichOk =
    enrichProvider === "anthropic"
      ? !!config.ANTHROPIC_API_KEY
      : enrichProvider === "openai"
        ? !!config.OPENAI_API_KEY
        : enrichProvider === "ollama"
          ? !!config.OLLAMA_BASE_URL
          : false;

  const searchOk =
    searchProvider === "anthropic"
      ? !!config.ANTHROPIC_API_KEY
      : searchProvider === "openai"
        ? !!config.OPENAI_API_KEY
        : searchProvider === "ollama"
          ? !!config.OLLAMA_BASE_URL
          : false;

  if (!enrichOk) {
    const key = PROVIDER_LABEL[enrichProvider] ?? enrichProvider;
    issues.push(
      `LECTIO_ENRICH_PROVIDER="${enrichProvider}" but ${key} is not set. Enrichment will fail.`,
    );
  }

  if (!searchOk) {
    const key = PROVIDER_LABEL[searchProvider] ?? searchProvider;
    issues.push(
      `LECTIO_SEARCH_PROVIDER="${searchProvider}" but ${key} is not set. Search will fail.`,
    );
  }

  const embedProvider = config.LECTIO_EMBED_PROVIDER;
  const embedOk = embedProvider
    ? embedProvider === "anthropic"
      ? !!config.ANTHROPIC_API_KEY
      : embedProvider === "openai"
        ? !!config.OPENAI_API_KEY
        : embedProvider === "ollama"
          ? !!config.OLLAMA_BASE_URL
          : false
    : true; // no embed provider = lexical-only, that's fine

  const ready = enrichOk && searchOk;

  return NextResponse.json({ providers: configured, enrichOk, searchOk, embedOk, ready, issues });
}
