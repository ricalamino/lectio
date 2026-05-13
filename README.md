# Lectio

**Your second brain. Self-hosted. Bring your own model.**

Lectio is an open-source capture-first knowledge app. You throw
anything in — links, fleeting thoughts, voice notes, photos — and
an LLM working in the background organizes, connects, and makes it
all searchable in natural language.

No folders. No tags to maintain. No structure to design. Just
capture. Lectio figures out the rest.

> **Alpha software.** Works well for personal use, rough edges
> remain. See the [ship checklist](#ship-checklist) for known gaps.

## Why Lectio?

- **Capture-first.** Zero friction. Paste a link, type a thought,
  share from any app. Done.
- **Self-hosted.** Your notes live on your server, not ours.
- **Bring your own model.** Anthropic or OpenAI for cloud,
  Ollama for fully local. Mix providers per task.
- **Mobile-first PWA.** Install on your phone home screen.
  Works offline — captures sync when you reconnect.
- **Plain JSON/Markdown export.** If Lectio disappears tomorrow,
  you keep readable files. Forever.
- **MCP server built-in.** Plug Lectio into Claude Desktop,
  Cursor, or any MCP client. Your second brain, reachable from
  your AI coding environment.

## Quick start

```bash
git clone https://github.com/ricalamino/lectio
cd lectio
cp .env.example .env
# Edit .env — set ADMIN_PASSWORD, AUTH_SECRET, and at least one LLM key
docker compose up -d
```

Open `http://localhost:3000` and log in with `admin` + the password
you set. That's it.

### Minimum .env for Anthropic

```env
POSTGRES_PASSWORD=change-me
MINIO_ROOT_PASSWORD=change-me
AUTH_SECRET=change-me-32-char-random-string
ADMIN_PASSWORD=your-admin-password

ANTHROPIC_API_KEY=sk-ant-...

LECTIO_ENRICH_PROVIDER=anthropic
LECTIO_ENRICH_MODEL=claude-haiku-4-5
LECTIO_SEARCH_PROVIDER=anthropic
LECTIO_SEARCH_MODEL=claude-haiku-4-5
# No embeddings = lexical search only (still works great)
```

### Minimum .env for fully local (Ollama)

```env
POSTGRES_PASSWORD=change-me
MINIO_ROOT_PASSWORD=change-me
AUTH_SECRET=change-me-32-char-random-string
ADMIN_PASSWORD=your-admin-password

OLLAMA_BASE_URL=http://host.docker.internal:11434

LECTIO_ENRICH_PROVIDER=ollama
LECTIO_ENRICH_MODEL=llama3.2
LECTIO_SEARCH_PROVIDER=ollama
LECTIO_SEARCH_MODEL=llama3.2
LECTIO_EMBED_PROVIDER=ollama
LECTIO_EMBED_MODEL=nomic-embed-text
# nomic-embed-text outputs 768 dimensions — see Embedding note below
```

> **Embedding note:** The DB vector column defaults to 1536 dimensions
> (OpenAI `text-embedding-3-small`). If you switch to a different
> embedding model, you must drop and recreate the `embedding` column
> with the correct dimension before running the worker. Mixing models
> after existing embeddings exist will cause the vector index to silently
> produce wrong similarity results.

## How it works

1. **Capture** — type, paste, or share from any app. Stored raw.
2. **Enrich** — LLM extracts title, summary, tags, entities,
   suggested actions, and a vector embedding. Runs in the background.
3. **Connect** — Lectio finds related captures and links them
   (continuation, contradiction, pattern, same entity in new context).
4. **Recall** — natural-language search across everything you ever
   captured, with cited sources.

## LLM providers

| Provider | Chat/JSON | Streaming | Embeddings | Status |
|---|---|---|---|---|
| Anthropic | ✅ | ✅ | ❌ | Supported |
| OpenAI | ✅ | ✅ | ✅ | Supported |
| Ollama | ✅ | ✅ | ✅ | Supported |
| Google | ❌ | ❌ | ❌ | Not implemented yet |
| OpenRouter | ❌ | ❌ | ❌ | Not implemented yet |
| OpenAI-compatible | ❌ | ❌ | ❌ | Not implemented yet |

Configure via `.env` — see `.env.example` for all variables and
[docs/cost-guide.md](docs/cost-guide.md) for approximate per-capture costs.

## Roadmap

- [x] Text capture
- [x] Enrichment pipeline (title, summary, tags, entities, actions)
- [x] Semantic + lexical hybrid search with streaming answers
- [x] Connection suggestions + review UI
- [x] PWA with share target + offline capture queue
- [x] MCP server
- [x] Export (JSON + Markdown ZIP)
- [x] Delete / edit captures + retry enrichment
- [ ] Voice note transcription (Whisper) — API wired, needs end-to-end testing
- [ ] Image / OCR capture (OpenAI Vision) — API wired, needs end-to-end testing
- [ ] Import (WhatsApp, Notion API, Logseq, Apple Notes, Markdown ZIP) — implemented, needs testing
- [ ] Weekly digest
- [ ] Multi-user
- [ ] Plugin system

## Ship checklist

Items needed before a public Reddit post. Tackled in order.

### Critical

- [ ] **Screenshots / demo GIF** — need 2–3 real screenshots of inbox,
      capture, and search result.
- [x] **Embedding dimension flexibility** — `LECTIO_EMBED_DIMENSIONS` env
      var + clear mismatch error. See `.env.example` for Ollama config.
- [x] **First-run onboarding** — setup banner shows on first login when
      provider keys are missing, with actionable error messages.
- [x] **Better worker error surfacing** — enrichment error code + detail
      shown on capture detail page above the Retry button.
- [x] **Honest provider table** — provider support table in README shows
      Google/OpenRouter/OpenAI-compatible as "Not implemented yet".

### Important

- [x] **Cost documentation** — see [docs/cost-guide.md](docs/cost-guide.md)
      for per-capture and per-search estimates per provider/model.
- [x] **Backup / restore guide** — see [docs/backup-restore.md](docs/backup-restore.md).
- [x] **Rate limiting / cost guardrails** — `LECTIO_MAX_ENRICH_PER_DAY`
      env var caps daily enrichments; jobs stay queued for tomorrow.
- [x] **Troubleshooting guide** — see [docs/troubleshooting.md](docs/troubleshooting.md).
- [ ] **Voice + image capture testing** — transcription and OCR paths
      are wired up but haven't been end-to-end tested. Confirm or
      remove from feature claims.
- [ ] **Import testing** — WhatsApp / Notion / Logseq importers are
      scaffolded. Confirm they work or remove from roadmap.

### Polish

- [x] **Comparison table** — see [docs/comparison.md](docs/comparison.md)
      for honest comparison vs Obsidian, Notion, Logseq, Mem.ai.
- [x] **Markdown editor with preview** — tabbed Preview/Edit panel with
      markdown rendering via `marked` (lazy-loaded).
- [x] **Background Sync PWA** — registers a `sync-captures` tag on
      enqueue; SW messages open clients to flush on reconnect.
- [x] **Architecture diagram** — ASCII diagram added to
      [docs/architecture.md](docs/architecture.md).
- [ ] **Weekly digest** — email/push summary of what you captured
      and what connections were found.

### Positioning

- [x] **Alpha disclaimer** — prominent alpha notice added at top of README.
- [x] **Reddit post draft** — see [docs/reddit-post-draft.md](docs/reddit-post-draft.md)
      for r/selfhosted, r/PKMS, and r/LocalLLaMA drafts + timing notes.

## Docs

- [docs/cost-guide.md](docs/cost-guide.md) — per-capture and per-search cost estimates
- [docs/backup-restore.md](docs/backup-restore.md) — how to back up and restore
- [docs/troubleshooting.md](docs/troubleshooting.md) — common issues and fixes
- [docs/comparison.md](docs/comparison.md) — comparison with Obsidian, Notion, Logseq, Mem.ai
- [docs/architecture.md](docs/architecture.md) — package layout and data flow
- [docs/llm-providers.md](docs/llm-providers.md) — provider configuration details

## Contributing

PRs welcome. Open an issue first for non-trivial changes.

## License

MIT. Do whatever you want. Forks encouraged.
