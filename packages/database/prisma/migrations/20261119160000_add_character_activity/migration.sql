BEGIN;

ALTER TABLE "characters" ADD COLUMN "last_active_at" TIMESTAMPTZ(3),
ADD COLUMN "inactive_since" TIMESTAMPTZ(3);

CREATE INDEX "characters_fame_refresh_idx" ON "characters"("server_id", "character_id") WHERE "inactive_since" IS NULL AND "basic_fetched_at" IS NOT NULL;

CREATE INDEX "characters_inactive_idx" ON "characters"("server_id", "character_id") WHERE "inactive_since" IS NOT NULL;

COMMIT;
