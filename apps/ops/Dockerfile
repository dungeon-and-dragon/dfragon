FROM docker.io/library/node:26-bookworm-slim@sha256:86f07bc9c5dce4578cf37e5a418b7bfc7f817cda25cde66e2b66e95ed86c4567 AS build
WORKDIR /workspace
# Prisma picks the engine build from the OpenSSL it detects at install time.
RUN apt-get update \
    && apt-get install --yes --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
RUN npm install --global pnpm@12.11.2
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/ops/package.json apps/ops/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/lib/package.json packages/lib/package.json
COPY packages/http-server/package.json packages/http-server/package.json
COPY packages/licenses/package.json packages/licenses/package.json
COPY packages/licenses/src/copy-notices.mjs packages/licenses/src/copy-notices.mjs
RUN pnpm install --frozen-lockfile --filter @dfragon/ops...
COPY packages/database/tsconfig.json packages/database/tsconfig.json
COPY packages/database/src packages/database/src
COPY packages/database/prisma packages/database/prisma
COPY packages/lib/tsconfig.json packages/lib/tsconfig.json
COPY packages/lib/src packages/lib/src
COPY packages/http-server/tsconfig.json packages/http-server/tsconfig.json
COPY packages/http-server/src packages/http-server/src
COPY packages/licenses/notices/lib packages/licenses/notices/lib
COPY apps/ops/tsconfig*.json apps/ops/
COPY apps/ops/src apps/ops/src
COPY apps/ops/test apps/ops/test
RUN pnpm --filter @dfragon/ops test \
    && pnpm --filter @dfragon/ops deploy --legacy --prod /production
# Prisma's remeda dependency ships without its license text.
COPY packages/licenses/notices/upstream/remeda-2.53.0-LICENSE.txt apps/ops/dist/notices/remeda-2.53.0-LICENSE.txt

FROM docker.io/library/node:26-bookworm-slim@sha256:86f07bc9c5dce4578cf37e5a418b7bfc7f817cda25cde66e2b66e95ed86c4567 AS runtime
ARG SOURCE_COMMIT=""
ENV NODE_ENV=production
WORKDIR /app
# Prisma's query compiler and pg adapter run without OpenSSL; the ops app applies no migrations.
COPY scripts/server-build-info.mjs /tmp/dfragon-server-build-info.mjs
RUN node /tmp/dfragon-server-build-info.mjs ops "$SOURCE_COMMIT" /app/build-info.json \
    && rm /tmp/dfragon-server-build-info.mjs
COPY --from=build /production/package.json ./package.json
COPY --from=build /production/node_modules ./node_modules
COPY --from=build /workspace/apps/ops/dist ./dist
COPY --chmod=755 apps/ops/docker-entrypoint.sh /usr/local/bin/dfragon-ops-entrypoint
USER node
ENTRYPOINT ["dfragon-ops-entrypoint"]
CMD ["node", "dist/main.js"]
