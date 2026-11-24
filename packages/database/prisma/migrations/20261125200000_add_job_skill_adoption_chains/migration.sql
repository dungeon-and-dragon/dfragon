BEGIN;

-- AlterTable
ALTER TABLE "job_skill_adoption" ADD COLUMN "chains" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "chain_sample_size" INTEGER NOT NULL DEFAULT 0;

COMMIT;
