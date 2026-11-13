BEGIN;

-- CreateTable
CREATE TABLE "clear_records" (
    "server_id" TEXT NOT NULL,
    "character_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mode_name" TEXT,
    "hard" BOOLEAN,
    "party_name" TEXT,
    "cleared_at" TIMESTAMPTZ(3) NOT NULL,
    "week_start" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "clear_records_pkey" PRIMARY KEY ("server_id","character_id","cleared_at","kind","name"),
    CONSTRAINT "clear_records_kind_check" CHECK (
        ("kind" = 'raid' AND "hard" IS NOT NULL)
        OR ("kind" = 'legion' AND "mode_name" IS NULL AND "hard" IS NULL AND "party_name" IS NULL)
    )
);

-- CreateIndex
CREATE INDEX "clear_records_kind_name_week_start_idx" ON "clear_records"("kind", "name", "week_start");

COMMIT;
