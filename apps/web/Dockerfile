FROM docker.io/library/node:26-bookworm-slim@sha256:86f07bc9c5dce4578cf37e5a418b7bfc7f817cda25cde66e2b66e95ed86c4567 AS build
WORKDIR /workspace
RUN npm install --global pnpm@12.11.2
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/design/package.json packages/design/package.json
COPY packages/lib/package.json packages/lib/package.json
COPY packages/licenses/package.json packages/licenses/package.json
COPY packages/models/package.json packages/models/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile --filter @dfragon/web...
COPY packages/design packages/design
COPY packages/lib packages/lib
COPY packages/licenses packages/licenses
COPY packages/ui packages/ui
COPY packages/models/ocr-finetuned packages/models/ocr-finetuned
COPY apps/web apps/web
COPY packages/server-core/test/fixtures/character-card-buffer.json packages/server-core/test/fixtures/character-card-dealer.json packages/server-core/test/fixtures/
ARG SOURCE_COMMIT=""
RUN pnpm --filter @dfragon/web build
COPY scripts/server-build-info.mjs scripts/server-build-info.mjs
RUN node scripts/server-build-info.mjs web "$SOURCE_COMMIT" /workspace/build-info.json

# The deploy helper runs this container as 1000:1000 with a read-only root, no capabilities and a tmpfs /tmp.
# The Nitro server needs no writable path and listens on an unprivileged port.
FROM docker.io/library/node:26-bookworm-slim@sha256:86f07bc9c5dce4578cf37e5a418b7bfc7f817cda25cde66e2b66e95ed86c4567 AS runtime
ENV NODE_ENV=production
ENV PORT=8080
# Without this the cluster forks one worker per host CPU, not per container CPU limit, and runs out of memory.
# The deploy raises it together with the service's CPU and memory limits.
ENV NITRO_CLUSTER_WORKERS=1
WORKDIR /app
# The fleet probes this service with wget, as it did the earlier Caddy image. Keeping that probe working lets a
# deploy move between the two images in either direction without changing the service definition first.
RUN apt-get update \
    && apt-get install --yes --no-install-recommends wget \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /workspace/build-info.json /app/build-info.json
COPY --from=build /workspace/apps/web/.output /app/.output
USER 1000:1000
EXPOSE 8080
CMD ["node", ".output/server/index.mjs"]
