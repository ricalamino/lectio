#!/bin/sh
# Apply migrations, then exec the real command. Both the web and the worker
# containers share this entrypoint, but only one of them actually needs to
# migrate — running it twice is idempotent (drizzle's __drizzle_migrations
# table tracks applied versions), so we let either side win the race.
#
# The migrate script lives inside the worker's self-contained deployment
# (produced by `pnpm deploy`), which is the only place where @lectio/core's
# `migrate.js` has its `drizzle-orm` and `postgres` deps resolved.
set -e

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[entrypoint] DATABASE_URL is not set; aborting" >&2
  exit 1
fi

if [ "${LECTIO_SKIP_MIGRATE:-}" = "1" ]; then
  echo "[entrypoint] LECTIO_SKIP_MIGRATE=1 — skipping migrations"
else
  echo "[entrypoint] applying migrations..."
  cd /app/worker && node ./node_modules/@lectio/core/dist/db/migrate.js
  cd /app
fi

exec "$@"
