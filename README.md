# Lectio

**Your second brain. Self-hosted. Bring your own model.**

Lectio is an open-source capture-first knowledge app. You throw 
anything in — voice notes, photos, links, fleeting thoughts — 
and an LLM working in the background organizes, connects, and 
makes it all searchable in natural language.

No folders. No tags to maintain. No structure to design. Just 
capture. Lectio figures out the rest.

![demo](docs/demo.gif)

## Why Lectio?

- **Capture-first.** Zero friction. Talk into your phone, snap 
  a whiteboard, paste a link. Done.
- **Self-hosted.** Your thoughts live on your server, not ours.
- **Bring your own model.** Anthropic, OpenAI, Gemini, or 
  local via Ollama. Pick a different model per task.
- **Mobile-first PWA.** Install on your phone home screen. 
  Works offline. Share target integration.
- **Plain Markdown export.** If Lectio disappears tomorrow, you 
  keep readable files. Forever.
- **MCP server built-in.** Plug Lectio into Claude Desktop, 
  Cursor, OpenClaw, or any MCP client. Your second brain, 
  reachable from anywhere.

## Quick start

TBD
```bash
curl -fsSL https://lectio.in/install.sh | sh
```

That's it. The installer pulls the Docker images, generates 
secrets, runs migrations, and prompts you for your LLM 
provider keys. Open `http://localhost:3000` and start 
capturing.

### Manual install

```bash
git clone https://github.com/ricalamino/lectio
cd lectio
cp .env.example .env   # edit with your keys
docker compose up -d
```

## How it works

1. **Capture** — type, talk, snap, paste. Stored raw.
2. **Enrich** — an LLM extracts title, summary, tags, entities, 
   suggested actions, and a vector embedding. Runs in the 
   background.
3. **Connect** — Lectio finds related captures and proposes 
   non-obvious links (continuation, contradiction, pattern, 
   same entity in new context).
4. **Recall** — natural-language search across everything you 
   ever captured, with citations.

See [docs/scaffold-status.md](docs/scaffold-status.md) for the live checklist.

## LLM providers

Lectio is moving toward provider-agnostic model selection. The 
current implementation supports **Anthropic**, **OpenAI**, and **Ollama** 
(chat + JSON + embeddings). Google, OpenRouter, and OpenAI-compatible 
providers are stubbed until their adapters are built.

```yaml
# config.yaml
enrichment:
  provider: anthropic
  model: claude-sonnet-4-5

connections:
  provider: openai
  model: gpt-4o-mini    # cheaper for binary decisions

search:
  provider: anthropic
  model: claude-sonnet-4-5

embeddings:
  provider: openai
  model: text-embedding-3-small

transcription:
  provider: openai
  model: whisper-1
```

Provider names in config: `anthropic`, `openai`, `google`, 
`ollama`, `openrouter`, `openai-compatible`.

See [docs/architecture.md](docs/architecture.md) for package layout and data flow, and [docs/llm-providers.md](docs/llm-providers.md) for provider configuration.

## Roadmap

- [x] Text capture (voice/image/OCR still out of scope)
- [x] Enrichment pipeline
- [x] Semantic + lexical hybrid search
- [x] Connection suggestions + review UI
- [x] PWA with share target + offline capture queue (client-side)
- [x] MCP server
- [x] Import — WhatsApp `.txt`, Markdown ZIP, Notion (official API), Logseq graph, Apple Notes export
- [ ] Weekly digest
- [ ] Multi-user
- [ ] Plugin system

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. Do whatever you want. Forks encouraged.

## Acknowledgments

Inspired by [OpenClaw](https://openclaw.ai)'s approach to 
self-hosted, model-agnostic personal AI. Where OpenClaw is the 
agent that acts, Lectio is the memory that remembers. They're 
complementary — connect them via MCP.
