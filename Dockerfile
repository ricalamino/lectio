# syntax=docker/dockerfile:1.7
# Multi-stage build that produces a single image carrying both the Next.js
# server (default CMD) and the worker (`node dist/worker.js`). Multi-arch is
# driven by buildx — the release workflow targets linux/amd64 + linux/arm64.

ARG NODE_VERSION=20.18.0

FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# ---- deps: install once with the full lockfile so layer cache is sane ----
FROM base AS deps
WORKDIR /repo
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY turbo.json tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY packages/web/package.json packages/web/
COPY packages/worker/package.json packages/worker/
COPY packages/mcp-server/package.json packages/mcp-server/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---- build: compile core, build worker, build next standalone ----
FROM deps AS build
WORKDIR /repo
COPY . .
RUN pnpm --filter @lectio/core build
RUN pnpm --filter @lectio/worker build
RUN pnpm --filter @lectio/mcp-server build
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @lectio/web build

# ---- runtime: minimal node image with just what each entrypoint needs ----
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# Next.js standalone output already bundles its own minimal node_modules.
COPY --from=build /repo/packages/web/.next/standalone ./
COPY --from=build /repo/packages/web/.next/static ./packages/web/.next/static
COPY --from=build /repo/packages/web/public ./packages/web/public

# Worker + migrations + mcp-server, with their compiled output and a
# self-contained node_modules produced by `pnpm deploy`.
COPY --from=build /repo/packages/worker/dist ./worker/dist
COPY --from=build /repo/packages/mcp-server/dist ./mcp-server/dist
COPY --from=build /repo/packages/core/dist ./core/dist
COPY --from=build /repo/packages/core/src/db/migrations ./core/migrations

# Re-install only production deps for the non-web entrypoints. Using npm here
# (not pnpm) keeps the runtime layer free of workspace tooling.
COPY --from=build /repo/packages/worker/package.json ./worker/package.json
COPY --from=build /repo/packages/mcp-server/package.json ./mcp-server/package.json
RUN cd worker && npm install --omit=dev --no-audit --no-fund --ignore-scripts \
    && cd ../mcp-server && npm install --omit=dev --no-audit --no-fund --ignore-scripts

USER node
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Default: run the Next.js server. The compose file overrides `command` for
# the worker container to `node /app/worker/dist/index.js`.
CMD ["node", "packages/web/server.js"]
