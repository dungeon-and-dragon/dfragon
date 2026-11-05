BEGIN;

-- CreateIndex
CREATE INDEX "characters_guild_id_idx" ON "characters"("guild_id");

COMMIT;
