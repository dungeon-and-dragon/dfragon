BEGIN;

-- AlterTable
ALTER TABLE "characters" ADD COLUMN     "basic_fetched_at" TIMESTAMPTZ(3),
ADD COLUMN     "fame" INTEGER,
ADD COLUMN     "guild_id" TEXT,
ADD COLUMN     "guild_name" TEXT,
ADD COLUMN     "job_grow_id" TEXT,
ADD COLUMN     "job_grow_name" TEXT,
ADD COLUMN     "job_id" TEXT,
ADD COLUMN     "job_name" TEXT,
ADD COLUMN     "level" INTEGER;

-- CreateTable
CREATE TABLE "character_collection" (
    "server_id" TEXT NOT NULL,
    "character_id" TEXT NOT NULL,
    "queued_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempted_at" TIMESTAMPTZ(3),
    "failure" TEXT,

    CONSTRAINT "character_collection_pkey" PRIMARY KEY ("server_id","character_id")
);

-- CreateIndex
CREATE INDEX "character_collection_queued_at_idx" ON "character_collection"("queued_at");

COMMIT;
