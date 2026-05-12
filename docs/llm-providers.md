# LLM providers

Runtime selection uses `createProvider(name, env)` in `packages/core/src/llm/factory.ts`. Environment variables follow `ProviderEnv` in that file.

## Implemented

### Anthropic

- **Env:** `ANTHROPIC_API_KEY`
- **Capabilities:** chat completions, JSON mode via tool-style parsing (see `anthropic.ts`). **No embeddings** — use another provider for `LECTIO_EMBED_PROVIDER` when enriching with vectors.

### OpenAI

- **Env:** `OPENAI_API_KEY`
- **Capabilities:** chat, JSON `response_format`, and `text-embedding-3-small` (or other embedding models). Vector dimension in the DB is **1536** — use a model that outputs 1536 dims or adjust schema/migrations accordingly.

### Ollama

- **Env:** `OLLAMA_BASE_URL` (e.g. `http://host.docker.internal:11434` from a container, or `http://127.0.0.1:11434` locally).
- **Capabilities:** `/api/chat` for completions, `format: "json"` for structured outputs used by enrichment and connections, `/api/embed` for embeddings (single string or batch array).
- **Notes:** Pick embedding models whose dimension matches `vector(1536)` in `enrichments.embedding`, or change the schema to match your model (e.g. 768 for `nomic-embed-text` would require a migration). Chat models must follow the JSON shapes expected by the Zod schemas in `packages/core/src/prompts/`.

## Stubbed (not wired)

`google`, `openrouter`, and `openai-compatible` still throw `LlmError` until dedicated adapters are added.

## Typical combinations

| Scenario | Enrich | Embed | Search |
|----------|--------|-------|--------|
| Cloud default | Anthropic | OpenAI | Anthropic |
| All local | Ollama chat model | Ollama embed model | Ollama |

Worker env keys: `LECTIO_ENRICH_PROVIDER`, `LECTIO_ENRICH_MODEL`, optional `LECTIO_EMBED_PROVIDER`, `LECTIO_EMBED_MODEL`. Web search uses `LECTIO_SEARCH_PROVIDER` / `LECTIO_SEARCH_MODEL` and optional `LECTIO_EMBED_*` for hybrid retrieval.

## Voice transcription & image OCR (worker)

When a capture has `media_key` and empty `raw_text`, the enrich worker can pull the object from S3 and run **OpenAI-only** preprocessing before the normal enrichment LLM:

- **Whisper:** `LECTIO_WHISPER_MODEL` (default `whisper-1`) — used for `kind=voice`, or `kind=file` with an audio MIME/extension.
- **Vision OCR:** `LECTIO_VISION_MODEL` (default `gpt-4o-mini`) — used for `kind=image`, or `kind=file` with an image MIME/extension.

Requires `OPENAI_API_KEY` plus `S3_*` on the **worker** (same MinIO/S3 variables as the web app). Implementation: `packages/core/src/integrations/openaiMedia.ts`, wired from `packages/worker/src/handlers/enrich.ts`.

This is **not** exposed through `LlmProvider`; it uses the OpenAI SDK directly in core (same rule exception as embeddings living next to OpenAI).
