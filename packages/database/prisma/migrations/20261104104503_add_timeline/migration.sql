BEGIN;

-- CreateTable
CREATE TABLE "seasons" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adventures" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY,
    "name" TEXT NOT NULL,

    CONSTRAINT "adventures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "characters" (
    "server_id" TEXT NOT NULL,
    "character_id" TEXT NOT NULL,
    "character_name" TEXT NOT NULL,
    "adventure_id" BIGINT NOT NULL,

    CONSTRAINT "characters_pkey" PRIMARY KEY ("server_id","character_id")
);

-- CreateIndex
CREATE INDEX "adventures_name_idx" ON "adventures"("name");

-- CreateIndex
CREATE INDEX "characters_adventure_id_idx" ON "characters"("adventure_id");

-- CreateIndex
CREATE INDEX "characters_server_id_character_name_idx" ON "characters"("server_id", "character_name");

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_adventure_id_fkey" FOREIGN KEY ("adventure_id") REFERENCES "adventures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "timeline_events" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY,
    "server_id" TEXT NOT NULL,
    "character_id" TEXT NOT NULL,
    "code" INTEGER NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "name" TEXT NOT NULL,
    "raid_name" TEXT,
    "data" JSONB NOT NULL,

    CONSTRAINT "timeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeline_items" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY,
    "server_id" TEXT NOT NULL,
    "character_id" TEXT NOT NULL,
    "code" INTEGER NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "name" TEXT NOT NULL,
    "item_id" TEXT,
    "item_name" TEXT,
    "item_rarity" TEXT,
    "data" JSONB NOT NULL,

    CONSTRAINT "timeline_items_pkey" PRIMARY KEY ("id","occurred_at")
) PARTITION BY RANGE ("occurred_at");

CREATE TABLE "timeline_items_season_1" PARTITION OF "timeline_items"
    FOR VALUES FROM ('2025-01-09 06:00:00+09') TO ('2026-03-26 06:00:00+09');

CREATE TABLE "timeline_items_season_2" PARTITION OF "timeline_items"
    FOR VALUES FROM ('2026-03-26 06:00:00+09') TO (MAXVALUE);

-- CreateTable
CREATE TABLE "timeline_sync_state" (
    "server_id" TEXT NOT NULL,
    "character_id" TEXT NOT NULL,
    "synced_until" TIMESTAMPTZ(3),
    "last_attempted_at" TIMESTAMPTZ(3),
    "last_succeeded_at" TIMESTAMPTZ(3),
    "last_failure" TEXT,

    CONSTRAINT "timeline_sync_state_pkey" PRIMARY KEY ("server_id","character_id")
);

-- CreateIndex
CREATE INDEX "timeline_events_server_id_character_id_code_occurred_at_idx" ON "timeline_events"("server_id", "character_id", "code", "occurred_at");

-- CreateIndex
CREATE INDEX "timeline_items_server_id_character_id_code_occurred_at_idx" ON "timeline_items"("server_id", "character_id", "code", "occurred_at");

INSERT INTO "seasons" ("id", "name", "starts_at") VALUES
    (1, '중천', '2025-01-09 06:00:00+09'),
    (2, '천해천', '2026-03-26 06:00:00+09');

COMMIT;
