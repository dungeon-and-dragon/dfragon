BEGIN;

-- AlterTable
ALTER TABLE "character_skill_styles" ADD COLUMN "chain" JSONB;

COMMIT;
