# syntax=docker/dockerfile:1.7
# Multi-stage build that produces a single image carrying both the Next.js
# server (default CMD) and the worker (`node /app/worker/dist/index.js`).
# Multi-arch is driven by buildx — the release workflow targets linux/amd64
# + linux/arm64.

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

# ---- build: compile core, build worker/mcp, build next standalone --------
FROM deps AS build
WORKDIR /repo
COPY . .
RUN pnpm --filter @lectio/core build
RUN pnpm --filter @lectio/worker build
RUN pnpm --filter @lectio/mcp-server build
ENV NEXT_TELEMETRY_DISABLED=1
# Next may evaluate DB-backed route handlers during `next build`; placeholders
# satisfy env validation without baking real secrets into the image.
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
ENV AUTH_SECRET=build-time-placeholder-secret
ENV ADMIN_PASSWORD=build
RUN pnpm --filter @lectio/web build

# ---- deploy: produce self-contained dist trees for worker and mcp-server --
# `pnpm deploy` resolves workspace:* into real node_modules with the
# dependent packages copied in. The output is portable — no symlinks back
# into the monorepo.
FROM build AS deploy
WORKDIR /repo
RUN pnpm --filter @lectio/worker --prod deploy /out/worker
RUN pnpm --filter @lectio/mcp-server --prod deploy /out/mcp-server

# ---- runtime: minimal node image -----------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# ffmpeg: extracts the audio track from video captures before Whisper.
# Pulled from Debian's repo for reproducible builds across amd64/arm64.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && rm -rf /var/lib/apt/lists/*

# Next.js standalone bundle (self-contained node_modules subset).
COPY --from=build /repo/packages/web/.next/standalone ./
COPY --from=build /repo/packages/web/.next/static ./packages/web/.next/static
COPY --from=build /repo/packages/web/public ./packages/web/public

# Worker + mcp-server, each as a self-contained deployment from pnpm deploy.
COPY --from=deploy /out/worker ./worker
COPY --from=deploy /out/mcp-server ./mcp-server

# Entrypoint runs migrations against DATABASE_URL before exec'ing the real
# command. Both web and worker containers use this script.
COPY docker/entrypoint.sh /usr/local/bin/entrypoint
RUN chmod +x /usr/local/bin/entrypoint

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

ENTRYPOINT ["/usr/local/bin/entrypoint"]
CMD ["node", "packages/web/server.js"]
