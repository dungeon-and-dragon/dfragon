FROM docker.io/library/node:26-bookworm-slim@sha256:86f07bc9c5dce4578cf37e5a418b7bfc7f817cda25cde66e2b66e95ed86c4567 AS build
WORKDIR /workspace
# Prisma picks the schema engine build from the OpenSSL it detects at install time.
RUN apt-get update \
    && apt-get install --yes --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
RUN npm install --global pnpm@12.11.2
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/lib/package.json packages/lib/package.json
COPY packages/neople/package.json packages/neople/package.json
COPY packages/licenses/package.json packages/licenses/package.json
COPY packages/licenses/src/copy-notices.mjs packages/licenses/src/copy-notices.mjs
RUN pnpm install --frozen-lockfile --filter @dfragon/api...
COPY packages/database/tsconfig.json packages/database/tsconfig.json
COPY packages/database/src packages/database/src
COPY packages/database/prisma packages/database/prisma
COPY packages/lib/tsconfig.json packages/lib/tsconfig.json
COPY packages/lib/src packages/lib/src
COPY packages/neople/tsconfig.json packages/neople/tsconfig.json
COPY packages/neople/src packages/neople/src
COPY packages/licenses/notices/lib packages/licenses/notices/lib
COPY apps/api/tsconfig*.json apps/api/
COPY apps/api/src apps/api/src
COPY apps/api/test apps/api/test
COPY apps/api/test-support apps/api/test-support
COPY packages/models/score-engine/libdnfscore.so packages/models/score-engine/libdnfscore.so
RUN pnpm --filter @dfragon/api test \
    && pnpm --filter @dfragon/api deploy --legacy --prod /production \
    && find /production/node_modules -name schema-engine-debian-openssl-3.0.x -exec {} --version \; | grep -q schema-engine
COPY packages/licenses/notices/upstream/remeda-2.53.0-LICENSE.txt apps/api/dist/notices/remeda-2.53.0-LICENSE.txt
COPY packages/licenses/notices/score-engine apps/api/dist/notices/score-engine

FROM docker.io/library/node:26-bookworm-slim@sha256:86f07bc9c5dce4578cf37e5a418b7bfc7f817cda25cde66e2b66e95ed86c4567 AS runtime
ARG SOURCE_COMMIT=""
ENV NODE_ENV=production
ENV SCORE_LIBRARY_FILE=/app/score-engine/libdnfscore.so
WORKDIR /app
# The Prisma schema engine that applies migrations links against OpenSSL 3.
RUN apt-get update \
    && apt-get install --yes --no-install-recommends libssl3 \
    && rm -rf /var/lib/apt/lists/*
COPY scripts/server-build-info.mjs /tmp/dfragon-server-build-info.mjs
RUN node /tmp/dfragon-server-build-info.mjs api "$SOURCE_COMMIT" /app/build-info.json \
    && rm /tmp/dfragon-server-build-info.mjs
COPY --from=build /production/package.json ./package.json
COPY --from=build /production/node_modules ./node_modules
COPY --from=build /workspace/apps/api/dist ./dist
COPY --from=build /workspace/packages/models/score-engine/libdnfscore.so ./score-engine/libdnfscore.so
COPY --chmod=755 apps/api/docker-entrypoint.sh /usr/local/bin/dfragon-api-entrypoint
USER node
EXPOSE 3000
ENTRYPOINT ["dfragon-api-entrypoint"]
CMD ["node", "--import", "reflect-metadata", "dist/main.js"]
