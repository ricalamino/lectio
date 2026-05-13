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

Configure via `.env` — see `.env.example` for all variables.

## Roadmap

- [x] Text capture
- [x] Enrichment pipeline (title, summary, tags, entities, actions)
- [x] Semantic + lexical hybrid search with streaming answers
- [x] Connection suggestions + review UI
- [x] PWA with share target + offline capture queue
- [x] MCP server
- [x] Export (JSON + Markdown ZIP)
- [x] Delete / edit captures + retry enrichment
- [ ] Voice note transcription (Whisper) — wired but untested
- [ ] Image / OCR capture — wired but untested
- [ ] Import (WhatsApp, Notion, Logseq) — scaffolded, needs testing
- [ ] Weekly digest
- [ ] Multi-user
- [ ] Plugin system

## Ship checklist

Items needed before a public Reddit post. Tackled in order.

### Critical

- [ ] **Screenshots / demo GIF** — README references `docs/demo.gif`
      which doesn't exist yet. Need 2–3 real screenshots of inbox,
      capture, and search result.
- [ ] **Embedding dimension flexibility** — hardcoded 1536 in schema;
      switching to Ollama `nomic-embed-text` (768-dim) silently breaks
      vector search. Need a migration guide or runtime check with a
      clear error message.
- [ ] **First-run onboarding** — when `.env` is missing required keys
      the app either crashes or silently fails. Show a setup checklist
      on first login instead.
- [ ] **Better worker error surfacing** — enrichment failures are
      logged in the worker but not visible in the UI beyond "failed"
      status. Show the actual error reason on the capture detail page.
- [ ] **Honest provider table** — Google/OpenRouter/OpenAI-compatible
      are listed as supported in `.env.example` but throw "not
      implemented" at runtime. Table above is the fix; verify it.

### Important

- [ ] **Cost documentation** — approximate cost per capture and per
      search for each supported provider/model combination.
- [ ] **Backup / restore guide** — `pg_dump` + MinIO bucket sync.
      Without this, users will lose data on upgrades.
- [ ] **Rate limiting / cost guardrails** — easy to accidentally burn
      through API budget if the worker gets stuck in a retry loop.
      Add a daily cap env var or at minimum document the risk.
- [ ] **Troubleshooting guide** — top 10 issues (DB not connecting,
      worker not starting, embeddings wrong dimension, etc.).
- [ ] **Voice + image capture testing** — transcription and OCR paths
      are wired up but haven't been end-to-end tested. Confirm or
      remove from feature claims.
- [ ] **Import testing** — WhatsApp / Notion / Logseq importers are
      scaffolded. Confirm they work or remove from roadmap.

### Polish

- [ ] **Comparison table** — how Lectio differs from Obsidian,
      Notion, Logseq, Mem.ai, and Capacities. Essential for Reddit
      where "why not just use X?" is the first reply.
- [ ] **Markdown editor with preview** — current capture detail shows
      raw text in a textarea. Even basic \`\`\`code\`\`\` rendering helps.
- [ ] **Background Sync PWA** — currently the offline queue is
      retried on page load. Register a Background Sync task so
      captures flush even when the tab is closed.
- [ ] **Architecture diagram** — visual overview of the 4 packages
      and data flow. Helps contributors get oriented fast.
- [ ] **Weekly digest** — email/push summary of what you captured
      and what connections were found.

### Positioning

- [ ] **Alpha disclaimer** — make it prominent that this is alpha
      software, solo-maintained, no SLA. Prevents angry posts.
- [ ] **Reddit post draft** — write the r/selfhosted and
      r/PKMS post before publishing. Check subreddit rules first
      (r/selfhosted requires a GitHub link + self-hosting angle;
      r/PKMS prefers workflow demos over feature lists).

## Contributing

PRs welcome. Open an issue first for non-trivial changes.

## License

MIT. Do whatever you want. Forks encouraged.
