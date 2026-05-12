# Architecture

Lectio is a small monorepo optimized for self-hosting with Docker Compose.

## Packages

| Package | Role |
|--------|------|
| `packages/core` | Drizzle schema and migrations, LLM provider abstraction (`createProvider`), shared prompts (`packages/core/src/prompts`). No UI or Next.js imports. |
| `packages/web` | Next.js 14 App Router: UI, authenticated API routes, next-auth (credentials), PWA manifest + service worker, MinIO uploads via `@aws-sdk/client-s3`. |
| `packages/worker` | Long-running Node process using `pg-boss` on the same Postgres as the app. Handles `enrich_capture` and `generate_connections` jobs. |
| `packages/mcp-server` | MCP stdio server exposing tools over captured data for desktop clients. |

## Data flow

1. **Capture** — User creates a row in `captures` (web UI, share target, or API). Status defaults to `pending`.
2. **Queue** — Web publishes `enrich_capture` to `pg-boss` (see `packages/web/src/lib/queue.ts`).
3. **Enrich** — Worker loads the capture, calls the configured LLM with `ENRICHMENT_SYSTEM_PROMPT`, validates JSON with Zod, optionally embeds text (OpenAI or Ollama), writes `enrichments`, sets capture status to `enriched` or `failed`.
4. **Connect** — Worker runs `generate_connections` for the same capture id, proposes edges into `connections`, respecting existing links and `rejected_connection_edges`.
5. **Search** — Web route merges lexical SQL with optional pgvector retrieval when query embeddings are available, then asks the search LLM for an answer with citations.

## Runtime layout (Docker)

- Single image builds Next.js standalone, worker deploy bundle, and MCP deploy bundle.
- `docker/entrypoint.sh` runs Drizzle migrations (unless `LECTIO_SKIP_MIGRATE=1`) then starts the container command (default: Next server).
- Postgres includes the `vector` extension; MinIO holds optional media keys referenced by `captures.media_key`.

## Auth (MVP)

Single admin user via `ADMIN_PASSWORD` and next-auth JWT session. All app routes except login, auth callback, PWA assets, and share target are gated by middleware.
