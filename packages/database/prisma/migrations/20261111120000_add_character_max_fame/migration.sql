BEGIN;

ALTER TABLE "characters" ADD COLUMN "max_fame" INTEGER;

UPDATE "characters" SET "max_fame" = "fame" WHERE "fame" IS NOT NULL;

CREATE INDEX "characters_max_fame_idx" ON "characters"("max_fame" DESC);

COMMIT;
