BEGIN;

-- CreateTable
CREATE TABLE "content_clears" (
    "content_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "server_id" TEXT NOT NULL,
    "character_id" TEXT NOT NULL,
    "week_start" TIMESTAMPTZ(3) NOT NULL,
    "cleared_at" TIMESTAMPTZ(3) NOT NULL,
    "ratio" INTEGER,

    CONSTRAINT "content_clears_pkey" PRIMARY KEY ("content_id","server_id","character_id","week_start"),
    CONSTRAINT "content_clears_kind_check" CHECK ("kind" IN ('raid', 'challenge'))
);

-- CreateIndex
CREATE INDEX "content_clears_content_id_week_start_idx" ON "content_clears"("content_id", "week_start");

-- 레이드는 주마다 한 행이고 챌린지는 캐릭터당 한 행이다. Prisma schema는 partial index를 나타내지 못해 migration에만 둔다.
CREATE UNIQUE INDEX "content_clears_challenge_key" ON "content_clears"("content_id", "server_id", "character_id") WHERE "kind" = 'challenge';

-- CreateTable
CREATE TABLE "content_clear_populations" (
    "content_id" TEXT NOT NULL,
    "week_start" TIMESTAMPTZ(3) NOT NULL,
    "population" INTEGER NOT NULL,
    "min_fame" INTEGER,
    "jobs" JSONB NOT NULL,
    "collected_at" TIMESTAMPTZ(3) NOT NULL,
    "closed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "content_clear_populations_pkey" PRIMARY KEY ("content_id","week_start")
);

COMMIT;
