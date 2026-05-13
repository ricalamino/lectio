# Reddit post drafts

## r/selfhosted

**Title:** I built a self-hosted, AI-powered capture-first knowledge base — throw anything in, it organizes itself

**Body:**

Hey r/selfhosted,

I've been building Lectio for the past few months and finally feel good enough
about it to share. It's a self-hosted capture-first knowledge app — the idea
is that the bottleneck in building a "second brain" isn't retrieval, it's the
friction of capture and organization.

**How it works:**
1. Capture anything — paste a link, type a thought, share from any app
2. A background worker (running a LLM of your choice) extracts title, summary,
   tags, entities, and a vector embedding
3. It finds connections between your captures (continuation, contradiction,
   pattern, same entity in new context)
4. Natural-language search across everything, with cited sources

**Self-hosting details:**
- Docker Compose stack: Next.js app + pg-boss worker + PostgreSQL 16 (pgvector) + MinIO
- Bring your own LLM: Anthropic, OpenAI, or fully local with Ollama
- PWA with offline queue — works on mobile, installable on home screen
- MCP server built-in — plug it into Claude Desktop or Cursor
- MIT license, fully open source

**Current state:** Alpha. Works well for personal use, rough edges remain
(no multi-user, no rich text editor, voice/image capture is wired but
undertested). See the README for the full ship checklist.

GitHub: https://github.com/ricalamino/lectio

Happy to answer questions about the architecture or self-hosting setup.

---

## r/PKMS

**Title:** Lectio — self-hosted capture-first PKM where an LLM organizes everything for you (no folders, no tags)

**Body:**

I've been thinking about the "capture friction" problem for a while. Most PKM
tools (Obsidian, Logseq, Notion) assume you'll do the organization work —
create folders, add tags, write links. I wanted something where I could just
dump raw thoughts and have the AI figure out the structure.

Lectio is my attempt at that. Key principles:
- **Zero-friction capture** — type, paste, or share from any app
- **AI does the organizing** — title, summary, tags, entities extracted automatically
- **Connections surface automatically** — "this note is a continuation of / contradicts / patterns with that one"
- **Natural-language recall** — "what did I capture about X?" with cited sources

It's self-hosted (Docker Compose) with a bring-your-own-model design —
Anthropic, OpenAI, or fully local with Ollama. There's also an MCP server so
you can query your knowledge base from Claude Desktop.

**Honest caveats:**
- Alpha software, solo maintained
- No rich text editor (plain text only)
- No multi-user
- Voice/image capture is wired but not fully tested
- Still missing a weekly digest / review feature

Comparison with alternatives: [docs/comparison.md](docs/comparison.md)

GitHub: https://github.com/ricalamino/lectio

Would love feedback from the PKM community, especially on the capture workflow.

---

## r/LocalLLaMA

**Title:** Self-hosted second brain powered by Ollama — capture notes, auto-organize, search with citations

**Body:**

Built a self-hosted knowledge base (Lectio) that runs entirely on local models
via Ollama. No API keys needed.

The workflow:
1. Capture anything (text, links, eventually voice/images)
2. Worker runs Ollama to extract title, summary, tags, entities, and generate
   an embedding (nomic-embed-text)
3. Finds connections between notes using vector similarity + LLM judgment
4. Search uses RAG — retrieves relevant notes and synthesizes an answer

Fully local config (add to your `.env`):
```
OLLAMA_BASE_URL=http://host.docker.internal:11434
LECTIO_ENRICH_PROVIDER=ollama
LECTIO_ENRICH_MODEL=llama3.2
LECTIO_SEARCH_PROVIDER=ollama
LECTIO_SEARCH_MODEL=llama3.2
LECTIO_EMBED_PROVIDER=ollama
LECTIO_EMBED_MODEL=nomic-embed-text
LECTIO_EMBED_DIMENSIONS=768
```

Quality is noticeably lower than Sonnet/GPT-4o for complex connections, but
totally fine for personal notes.

GitHub: https://github.com/ricalamino/lectio

---

## Timing and rules notes

- **r/selfhosted**: Post on weekday mornings UTC. Must include GitHub link.
  Avoid marketing language. The "I built X" format does well.
- **r/PKMS**: More philosophical audience. Lead with the workflow problem,
  not the tech. Comparison table helps.
- **r/LocalLLaMA**: Very technical audience. Show the actual config. They'll
  want to know model quality vs size trade-offs.
- Post to one subreddit at a time, wait 2–3 days before cross-posting.
- Add flair correctly — r/selfhosted has a "Project" flair.
