BEGIN;

CREATE TABLE "timeline_sync_requests" (
    "kind" TEXT NOT NULL,
    "server_id" TEXT NOT NULL,
    "character_id" TEXT NOT NULL,
    "season_id" INTEGER NOT NULL DEFAULT 0,
    "requested_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "awaited_at" TIMESTAMPTZ(3),
    "started_at" TIMESTAMPTZ(3),

    CONSTRAINT "timeline_sync_requests_pkey" PRIMARY KEY ("kind", "server_id", "character_id", "season_id"),
    CONSTRAINT "timeline_sync_requests_kind_check" CHECK ("kind" IN ('sync', 'enhancement-backfill', 'season-backfill'))
);

CREATE INDEX "timeline_sync_requests_pending_idx" ON "timeline_sync_requests"("kind", ("awaited_at" IS NULL), "requested_at") WHERE "started_at" IS NULL;

COMMIT;
