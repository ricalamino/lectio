# Reddit post drafts

## r/selfhosted

**Title:** Lectio — self-hosted second brain where an LLM does the organizing (docker compose, BYO model)

**Body:**

**Project Name:** Lectio

**Repo/Website Link:** https://github.com/ricalamino/lectio

**Description:**

A self-hosted "second brain" / capture-first PKM. The premise is that the
bottleneck isn't retrieval — it's the friction of writing things down and
organizing them. Most PKM tools (Obsidian, Notion, Logseq) assume you'll do
the organization. I wanted one where I could paste raw thoughts and links
and have an LLM figure out the structure.

How it works:
1. Capture text or paste a link with a short note
2. A background worker calls an LLM (yours — see below) to extract title,
   summary, tags, entities, and a vector embedding
3. It surfaces connections between captures (continuation, contradiction,
   pattern, same entity in new context)
4. Natural-language search over everything, with cited sources

Features:
- Bring your own model: Anthropic, OpenAI, or fully local with Ollama.
  Mix providers per task (e.g. cloud for enrichment, local for embeddings).
- PWA with offline capture queue — installable on a phone home screen,
  syncs when you reconnect.
- MCP server built-in — plug Lectio into Claude Desktop / Cursor / any
  MCP client and query your notes from your AI coding environment.
- Plain JSON + Markdown ZIP export. If Lectio disappears tomorrow, you
  keep readable files. Forever.
- Hybrid lexical + semantic search with streaming answers and citations.
- Tag-filtered search; daily cost cap env var; full backup/restore guide.

Honest about what doesn't work yet (because someone will ask):
- Pasting a link enriches the *text you write*, not the page behind it.
  Automatic URL fetch + readability is on the roadmap.
- Voice/image capture code is in the repo but not validated yet — I'm not
  claiming them as features.
- Solo-maintained alpha. No multi-user, no rich-text editor, no weekly
  digest. Full ship checklist is in the README.

**Deployment:**

Released and ready to self-host. MIT license.

Stack: Docker Compose with Next.js (app) + pg-boss (worker) + PostgreSQL
16 with pgvector + MinIO for object storage. Single command to bring up:

```
git clone https://github.com/ricalamino/lectio
cd lectio
cp .env.example .env
# Set ADMIN_PASSWORD, AUTH_SECRET, and at least one LLM key
docker compose up -d
```

Then open `http://localhost:3000` and log in.

Docs in-repo:
- README has Quick Start, minimum `.env` examples for both Anthropic and
  fully-local Ollama setups, and a provider support table
- [docs/architecture.md](https://github.com/ricalamino/lectio/blob/main/docs/architecture.md) — package layout + data flow diagram
- [docs/cost-guide.md](https://github.com/ricalamino/lectio/blob/main/docs/cost-guide.md) — per-capture cost estimates per provider/model
- [docs/backup-restore.md](https://github.com/ricalamino/lectio/blob/main/docs/backup-restore.md) — how to back up Postgres + MinIO
- [docs/troubleshooting.md](https://github.com/ricalamino/lectio/blob/main/docs/troubleshooting.md) — common spinning-up issues

**AI Involvement:**

Two layers, being explicit about both:

1. **The app uses LLMs at runtime** — that's the whole point. Enrichment
   and search both call whichever provider you configure. With Ollama it's
   100% local; with Anthropic/OpenAI the only outbound traffic is to those
   APIs. No telemetry, no analytics, no accounts.

2. **The app was largely built with Claude Code** (Anthropic's CLI agent)
   over the last week. I designed the architecture, made the product
   decisions, wrote prompts, and pushed back when the model over-engineered
   — but a lot of the boilerplate (Drizzle migrations, the MCP server, the
   PWA service worker, provider abstractions) was written by Claude. The
   repo is structured cleanly enough that I'd point at it as a working
   example of what vibe-coding produces when you keep the agent on a
   tight leash.

I'd love feedback on the self-hosting story specifically — is the docker
compose stack the right shape? Should the worker be optional for people
who don't want async? Anything you hit while spinning it up, I want to
know about. Happy to answer architecture questions in the thread.

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
- Plain markdown only (no rich text editor)
- Text and links only — voice and image capture exist in the codebase
  but aren't validated yet, so I'm not claiming them as features
- No multi-user
- No bulk import from other tools yet
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
1. Capture text or links (voice/image are scaffolded in the repo but not
   validated yet — text-only for now)
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

## r/vibecoding

**Title:** Vibe-coded a self-hosted AI knowledge base in under a week with Claude Code — sharing the repo as a scaffold

**Body:**

Spent the last few days building **Lectio** — a self-hosted "second brain"
where you paste links/thoughts and an LLM titles, tags, summarizes, and
connects everything in the background. Built almost entirely with Claude
Code (CLI) as the pair.

**What it does** (quick):
- Capture text or a link with a short note
- Background worker calls an LLM to extract title/summary/tags/entities
- Natural-language search over everything, with cited sources
- MCP server so Claude Desktop / Cursor can query your notes

**Why I'm posting it here:** the value isn't just the app, it's that the
repo is structured cleanly enough to fork as a scaffold for similar
projects. If you're vibe-coding something that has:
- A web UI with auth
- Background jobs that call an LLM
- A queue
- Postgres + vector search
- An MCP integration
- A PWA

…most of the wiring is already done. MIT, take what you need.

**The stack** (TypeScript monorepo, `pnpm` + Turborepo):
```
packages/
  web/         Next.js 14 app router, auth, UI, API routes
  worker/      pg-boss consumer that runs the LLM enrichment
  core/        Drizzle schema, LLM provider abstraction, prompts
  mcp-server/  stdio MCP server exposing captures to AI clients
```

The LLM provider layer (`packages/core/src/llm/`) is the part I'm
most happy with — adding a new provider is one file. Anthropic, OpenAI,
and Ollama are wired; the abstraction kept Claude Code from drifting
when I swapped models mid-build.

**What Claude Code did well:**
- Carrying the monorepo conventions across packages without me re-explaining
- Drizzle migrations + schema changes (way less brittle than I expected)
- The whole MCP server in one session — I literally pasted the spec link
- Honest pushback when I tried to over-engineer (the architecture is simpler
  than my first three attempts)

**Where I had to babysit:**
- Prompt design for the enrichment LLM call — it kept wanting to write
  6-paragraph summaries until I gave it concrete examples
- PWA service worker / offline queue (specs are subtle, easy to break)
- Next 14 Router Cache vs server components — burned a few hours on stale
  data bugs that ended up being one missing `router.refresh()`

**Honest warts** (because you'll spot them anyway):
- Pasting a link enriches the *text you write*, not the page behind it
  (auto URL fetch is on the roadmap)
- Voice/image capture code exists but isn't validated yet
- Solo-built, alpha, no multi-user

**Repo (with screenshots + demo gif):** https://github.com/ricalamino/lectio

Happy to answer anything about the workflow — model choices, where I
pushed back on Claude's suggestions, how I structured the prompts that
drive the agent, etc. This is genuinely a "here's the receipt" post.

---

## Timing and rules notes

- **r/selfhosted**: Post on weekday mornings UTC. Must include GitHub link.
  Avoid marketing language. The "I built X" format does well.
- **r/PKMS**: More philosophical audience. Lead with the workflow problem,
  not the tech. Comparison table helps.
- **r/LocalLLaMA**: Very technical audience. Show the actual config. They'll
  want to know model quality vs size trade-offs.
- **r/vibecoding**: Audience wants the *how it was built*, not the product
  pitch. Lead with the tool you used (Claude Code), be honest about
  what the model carried and where you had to babysit. They sniff out
  marketing fast — keep it personal and concrete.
- Post to one subreddit at a time, wait 2–3 days before cross-posting.
- Add flair correctly — r/selfhosted has a "Project" flair.
