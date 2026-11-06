FROM docker.io/library/node:26-bookworm-slim@sha256:86f07bc9c5dce4578cf37e5a418b7bfc7f817cda25cde66e2b66e95ed86c4567 AS build
WORKDIR /workspace
RUN npm install --global pnpm@12.11.2
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/client/package.json packages/client/package.json
COPY packages/client-core/package.json packages/client-core/package.json
COPY packages/lib/package.json packages/lib/package.json
COPY packages/licenses/package.json packages/licenses/package.json
COPY packages/models/package.json packages/models/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile --filter @dfragon/web...
COPY packages/client packages/client
COPY packages/client-core packages/client-core
COPY packages/lib packages/lib
COPY packages/licenses packages/licenses
COPY packages/ui packages/ui
COPY packages/models/ocr-finetuned packages/models/ocr-finetuned
COPY apps/web apps/web
RUN pnpm --filter @dfragon/web build
ARG SOURCE_COMMIT=""
COPY scripts/server-build-info.mjs scripts/server-build-info.mjs
RUN node scripts/server-build-info.mjs web "$SOURCE_COMMIT" /workspace/build-info.json

# The deploy helper runs this container as 1000:1000 with a read-only root, no capabilities and a tmpfs /tmp,
# so Caddy keeps its config and data under /tmp and listens on an unprivileged port.
FROM docker.io/library/caddy:2.11.9-alpine@sha256:0bbb055bda6793c999bde78b1b5ce3e89f829fb031af2cf50056ea1246559fee AS runtime
ENV XDG_CONFIG_HOME=/tmp
ENV XDG_DATA_HOME=/tmp
COPY apps/web/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /workspace/build-info.json /app/build-info.json
COPY --from=build /workspace/apps/web/dist /srv
USER 1000:1000
EXPOSE 8080
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
