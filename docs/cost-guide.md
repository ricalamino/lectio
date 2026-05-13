# LLM cost guide

Lectio calls the LLM on every enrichment and every search. Here's what to
expect so you don't get surprised by your bill.

## Per-capture enrichment cost

Enrichment sends the raw content + a system prompt to the LLM and receives a
structured JSON response (title, summary, tags, entities, suggested action).

Typical token counts per capture (text only, no media):

| Content size | Tokens in | Tokens out | Notes |
|---|---|---|---|
| Short note (< 200 words) | ~800 | ~200 | Most captures |
| Medium note (200–1000 words) | ~1,500 | ~300 | Articles, docs |
| Long paste (1000–5000 words) | ~6,000 | ~400 | Docs, reports |

### Cost per 1000 captures (short notes)

| Provider | Model | $/1k captures |
|---|---|---|
| Anthropic | claude-haiku-4-5 | ~$0.06 |
| Anthropic | claude-sonnet-4-6 | ~$0.60 |
| OpenAI | gpt-4o-mini | ~$0.08 |
| OpenAI | gpt-4o | ~$1.20 |
| Ollama | any local | $0.00 |

> Prices as of May 2026. Check the provider's pricing page for current rates.
> These are rough estimates; actual cost depends on your content length.

## Per-search cost

Each search call sends up to 20 candidate captures to the LLM and asks it to
synthesize an answer. Typical token counts:

| | Tokens in | Tokens out |
|---|---|---|
| Typical search | ~4,000 | ~300 |

### Cost per 1000 searches

| Provider | Model | $/1k searches |
|---|---|---|
| Anthropic | claude-haiku-4-5 | ~$0.20 |
| Anthropic | claude-sonnet-4-6 | ~$2.00 |
| OpenAI | gpt-4o-mini | ~$0.25 |
| Ollama | any local | $0.00 |

## Embeddings

Embeddings run once per capture during enrichment. Cost is very low.

| Provider | Model | $/1k captures |
|---|---|---|
| OpenAI | text-embedding-3-small | ~$0.001 |
| OpenAI | text-embedding-ada-002 | ~$0.004 |
| Ollama | nomic-embed-text | $0.00 |

## Recommended low-cost setup

Use Haiku for enrichment and search, mini for embeddings:

```env
LECTIO_ENRICH_PROVIDER=anthropic
LECTIO_ENRICH_MODEL=claude-haiku-4-5
LECTIO_SEARCH_PROVIDER=anthropic
LECTIO_SEARCH_MODEL=claude-haiku-4-5
LECTIO_EMBED_PROVIDER=openai
LECTIO_EMBED_MODEL=text-embedding-3-small
```

At this config, enriching 1000 captures + doing 100 searches costs roughly
**$0.08 total**.

## Fully free (local only)

Set up [Ollama](https://ollama.ai) and use:

```env
OLLAMA_BASE_URL=http://host.docker.internal:11434
LECTIO_ENRICH_PROVIDER=ollama
LECTIO_ENRICH_MODEL=llama3.2
LECTIO_SEARCH_PROVIDER=ollama
LECTIO_SEARCH_MODEL=llama3.2
LECTIO_EMBED_PROVIDER=ollama
LECTIO_EMBED_MODEL=nomic-embed-text
LECTIO_EMBED_DIMENSIONS=768
```

Quality will be lower than cloud models, especially for complex queries.

## Avoiding unexpected charges

- The worker processes one job at a time by default (`batchSize: 2`). A
  large import won't suddenly spike your bill.
- If the enrichment worker gets stuck in a retry loop (e.g. a transient LLM
  error) it could burn tokens. Check worker logs if costs spike unexpectedly.
- pg-boss retries failed jobs with exponential backoff and a max retry count.
  Check the pg-boss configuration in `packages/worker/src/index.ts` for the
  current limits.
- There is no built-in daily spend cap yet. If you want to add one, set
  `batchSize: 1` and add a token-counting interceptor in the LLM provider
  wrappers in `packages/core/src/llm/`.
