BEGIN;

-- CreateTable
CREATE TABLE "timeline_season_backfill" (
    "server_id" TEXT NOT NULL,
    "character_id" TEXT NOT NULL,
    "season_id" INTEGER NOT NULL,
    "backfilled_until" TIMESTAMPTZ(3) NOT NULL,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "timeline_season_backfill_pkey" PRIMARY KEY ("server_id","character_id","season_id")
);

COMMIT;
