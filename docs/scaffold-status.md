# Scaffold Status

Last updated: 2026-05-12 (importers expansion + media adapter generalization).

This file tracks what from `claude-scaffold.txt` is complete, partial, or still
missing. Keep it updated as implementation moves.

## Complete

- Monorepo with `pnpm` workspaces and Turbo: `package.json`, `pnpm-workspace.yaml`, `turbo.json`.
- Core package with Drizzle schema, migrations, LLM abstraction, Anthropic/OpenAI/Ollama providers (Google/OpenRouter/OpenAI-compatible still stubbed), and prompts:
  - `packages/core/src/db/schema.ts`
  - `packages/core/src/db/migrations/`
  - `packages/core/src/llm/`
  - `packages/core/src/prompts/`
- Web package with Next.js App Router, auth, base layout/sidebar, capture/inbox/inbox detail/search/connections/export pages, and API routes:
  - `packages/web/src/app/`
  - `packages/web/src/auth.ts`
  - `packages/web/src/middleware.ts`
- Worker process using `pg-boss` and the shared `DATABASE_URL`:
  - `packages/worker/src/index.ts`
  - `packages/worker/src/jobs.ts`
- Enrichment pipeline:
  - `packages/worker/src/handlers/enrich.ts`
- Search prompt is wired into the web search route:
  - `packages/web/src/app/api/search/route.ts`
- MCP server with `search_captures`, `get_capture`, and `list_recent`:
  - `packages/mcp-server/src/index.ts`
- Dockerfile, docker compose, MIT license, CI workflow, and GHCR release workflow:
  - `Dockerfile`
  - `docker-compose.yml`
  - `LICENSE`
  - `.github/workflows/ci.yml`
  - `.github/workflows/release.yml`
- Connections review UI, feedback API, and persistence so dismissed pairs are not re-suggested:
  - `packages/web/src/app/connections/page.tsx`
  - `packages/web/src/app/api/connections/[id]/feedback/route.ts`
  - `packages/core/src/db/migrations/0001_rejected_edges.sql` (`rejected_connection_edges` + `feedback.connection_id` ON DELETE SET NULL)
  - Worker excludes rejected edges in `packages/worker/src/handlers/connect.ts`
- Plain Markdown export (latest 500 captures): `packages/web/src/app/export/page.tsx`, `packages/web/src/app/api/export/markdown/route.ts`
- Search answer inline citation highlight: `packages/web/src/components/search-answer.tsx`
- Ollama provider (chat, JSON, embeddings): `packages/core/src/llm/ollama.ts`, wired in `packages/core/src/llm/factory.ts`
- Capture detail page: `packages/web/src/app/inbox/[id]/page.tsx`
- Client offline capture queue (`localStorage`) + sync: `packages/web/src/lib/offline-capture-queue.ts`, `packages/web/src/app/capture/page.tsx`
- Docs: `docs/architecture.md`, `docs/llm-providers.md`, `CONTRIBUTING.md`
- Voice (Whisper) + image OCR (OpenAI vision) before enrich when `media_key` is set: `packages/core/src/integrations/openaiMedia.ts`, `packages/worker/src/handlers/enrich.ts`, `packages/worker/src/lib/s3-get.ts`
- Import pipeline: `packages/core/src/importers/*`, `POST /api/import`, `/import` UI. Sources:
  - WhatsApp `.txt` chat export
  - ZIP of plain Markdown
  - **Notion** via official API (internal integration token, walks `/search` + `/blocks/{id}/children`)
  - **Logseq** graph ZIP (walks `pages/*.md` and `journals/*.md`, strips block bullets and `key::` properties)
  - **Apple Notes** ZIP (Notes.app folder export of `.txt`/`.md`; folder name kept as tag)
- Generic transcription adapter (`packages/core/src/integrations/transcribe.ts`): OpenAI-hosted Whisper *or* any OpenAI-compatible server (faster-whisper-server, Speaches, LocalAI) via `LECTIO_TRANSCRIBE_BACKEND=openai_compatible` + `LECTIO_TRANSCRIBE_URL`.
- PDF text extraction (`packages/core/src/integrations/pdf.ts`): `pdf-parse`, native text only — scanned PDFs come back empty.
- Video transcription (`packages/core/src/integrations/video.ts`): `ffmpeg` extracts mono 16 kHz mp3 from any video, then routed through the transcription adapter. `ffmpeg` is installed in the runtime image.

## Partial

- Importers:
  - Main code: `packages/core/src/importers/`, `packages/web/src/app/api/import/route.ts`
  - Current state: WhatsApp `.txt`, ZIP of Markdown, Notion (official API), Logseq (graph directory ZIP), Apple Notes (Notes.app export ZIP).
  - Remaining: Logseq SQLite (DB version), richer WhatsApp date formats, Notion incremental sync, cost controls per import.
- Transcription / OCR:
  - Main code: `packages/core/src/integrations/transcribe.ts`, `packages/core/src/integrations/openaiMedia.ts`, `packages/core/src/integrations/pdf.ts`, `packages/core/src/integrations/video.ts`, worker enrich + S3 read.
  - Current state: transcription via OpenAI Whisper *or* any OpenAI-compatible local server; image OCR via OpenAI vision; PDF text via `pdf-parse`; video → ffmpeg extracts audio → Whisper.
  - Remaining: non-OpenAI vision (OCR), scanned-PDF OCR fallback, frame-level video captioning, cost controls.
- Connection suggestions:
  - Main code: `packages/worker/src/handlers/connect.ts`
  - Current state: candidate retrieval, LLM validation, pgvector/lexical, excludes existing connections and user-rejected `(from, to)` edges.
  - Remaining: automated tests for duplicate prevention / fallback ranking; optional boosting from repeated "useful" feedback.
- Search:
  - Main code: `packages/web/src/app/api/search/route.ts`, `packages/web/src/lib/search-retrieval.ts`, `packages/web/src/components/search-answer.tsx`
  - Current state: hybrid retrieval, `cited` payload, citation cards, `#xxxxxxxx` highlights in the answer text; query embeddings via OpenAI or Ollama when `LECTIO_EMBED_*` is set.
  - Remaining: tunable fusion weights / ranking tests against fixtures.
- PWA/share target:
  - Main code: `packages/web/public/manifest.webmanifest`, `packages/web/public/sw.js`, `packages/web/src/app/api/share/route.ts`
  - Current state: manifest, service worker caches `/inbox`, share capture, S3 upload when configured, **15MB max** per shared file, **client-side** offline queue on `/capture` with manual + `online` sync.
  - Remaining: IndexedDB + Background Sync in the service worker for capture replay without opening `/capture`.
- MinIO/storage:
  - Config: `docker-compose.yml`, `packages/web/src/lib/env.ts`
  - Current state: MinIO service, S3 env vars, `packages/web/src/lib/storage.ts` (put + signed GET + ensure bucket), share uploads (size-capped), `GET /api/captures/[id]/media` redirect.
  - Remaining: lifecycle policies, virus scanning, stricter quotas, non-redirect download patterns if needed.
- Multi-provider LLM support:
  - Main code: `packages/core/src/llm/`
  - Current state: Anthropic, OpenAI, and Ollama are implemented. Google, OpenRouter, and OpenAI-compatible remain stubs.
  - Remaining: implement the remaining stub providers or keep them explicitly unsupported.

## Missing

- Weekly digest.
- Multi-user support.
- Plugin system.

## Validation

Most recent local checks:

```bash
pnpm turbo run typecheck
pnpm turbo run lint
pnpm turbo run test
```

