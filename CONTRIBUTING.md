# Contributing

## Prerequisites

- Node 20+
- `pnpm` 9+
- Docker (optional, for Postgres + MinIO parity with production)

## Commands

```bash
pnpm install
pnpm turbo run typecheck lint test
```

Apply migrations when developing against a real database:

```bash
export DATABASE_URL=postgresql://...
pnpm --filter @lectio/core db:migrate
```

## Conventions

- **Language:** TypeScript, English identifiers and comments in code.
- **LLM access:** Only through `packages/core/src/llm/` — do not call vendor SDKs from web or worker except via `createProvider`.
- **Prompts:** Live in `packages/core/src/prompts/*.ts` as exported constants and builders, not inline in routes.
- **Database:** Schema changes require a new SQL migration under `packages/core/src/db/migrations/` and an updated Drizzle schema; run `pnpm --filter @lectio/core build` so `dist/db/migrations` stays in sync for Docker.

## Pull requests

Keep changes focused. Update `docs/scaffold-status.md` when you complete or materially change a roadmap area. CI runs typecheck, lint, and tests via Turborepo.
