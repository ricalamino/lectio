# Troubleshooting

## App won't start

**`Invalid environment: DATABASE_URL: Invalid url`**

The `DATABASE_URL` in your `.env` is missing or malformed. It must be a full
PostgreSQL URL: `postgresql://user:password@host:5432/dbname`.

---

**`Invalid environment: AUTH_SECRET: String must contain at least 16 character(s)`**

Generate a strong secret: `openssl rand -base64 32` and set it as `AUTH_SECRET`.

---

**`connect ECONNREFUSED 127.0.0.1:5432`**

The database isn't running or isn't reachable. If using Docker:
```bash
docker compose up -d postgres
docker compose logs postgres
```

## Worker issues

**Captures stay in "pending" forever**

The worker isn't running. Start it:
```bash
docker compose up -d   # if worker is a separate service
# or check it's part of the main compose file
docker compose ps
```

Check worker logs:
```bash
docker compose logs worker -f
```

---

**Captures fail immediately with "LLM returned a permanent error"**

Your API key is wrong or has no credit. Verify:
- `ANTHROPIC_API_KEY` starts with `sk-ant-`
- `OPENAI_API_KEY` starts with `sk-`
- Key has a positive balance at the provider's dashboard

---

**`embedding dimension mismatch: got 768, expected 1536`**

You switched embedding models after captures were already stored. The DB
column dimension must match the model output. Options:

1. Keep using the original model (revert `LECTIO_EMBED_PROVIDER`/`LECTIO_EMBED_MODEL`)
2. Drop and recreate the embedding column, then reprocess all captures:

```sql
ALTER TABLE enrichments DROP COLUMN embedding;
ALTER TABLE enrichments ADD COLUMN embedding vector(768);
```

Then set `LECTIO_EMBED_DIMENSIONS=768` and re-enrich all captures from the inbox.

---

**Worker crashes with `FATAL: role "lectio" does not exist`**

The database user wasn't created. This can happen if you changed
`POSTGRES_USER` after the volume was initialized. Either:
- Remove the postgres volume and restart: `docker compose down -v && docker compose up -d`
- Or create the user manually in psql

## Search issues

**Search returns nothing / "No captures found"**

- Do you have any captures with status "enriched"? Check the inbox filter.
- Is `LECTIO_SEARCH_PROVIDER` configured and the API key set?
- If using embeddings, were they generated? The `embedding` column in
  `enrichments` should be non-null for enriched captures.

---

**Search answer is always in English even though my captures are in Portuguese**

The search system prompt instructs the LLM to respond in the same language as
the query. If you're getting English answers for Portuguese queries, try a
more capable model for search (e.g. `claude-sonnet-4-6` instead of Haiku).

## MinIO / media issues

**Voice notes / images don't upload**

Check that `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, and `S3_SECRET_KEY`
are all set and the MinIO service is running:

```bash
docker compose logs minio
```

The bucket is created automatically on first use via the worker. If it
doesn't exist, check that the access credentials are correct.

---

**`NoSuchBucket` errors in worker logs**

The MinIO bucket (`lectio-media` by default) wasn't created. It's normally
auto-created by the app, but if MinIO started before the app:

```bash
docker run --rm \
  -e MC_HOST_local="http://lectio:${MINIO_ROOT_PASSWORD}@localhost:9000" \
  minio/mc mb local/lectio-media
```

## Auth issues

**Can't log in — "Invalid credentials"**

The `ADMIN_PASSWORD` env var must match exactly what you type. Passwords
are compared with `bcrypt` so there's no plain-text leak risk, but the
value must be set before first run.

---

**Session expires immediately**

`AUTH_SECRET` must be at least 16 characters and consistent across restarts.
If you regenerate it, all existing sessions are invalidated.

## PWA / offline issues

**"Share to Lectio" doesn't appear in the share sheet**

The PWA must be installed (added to home screen) for the share target to
appear. On iOS, use Safari → Share → Add to Home Screen.

---

**Offline captures aren't syncing after reconnecting**

The offline queue is retried on next page load. If captures still show as
pending in the queue (accessible via the capture page), try a manual refresh.
Background Sync is not yet implemented — see the ship checklist.
