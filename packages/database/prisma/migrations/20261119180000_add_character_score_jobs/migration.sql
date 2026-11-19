BEGIN;

-- AlterTable
ALTER TABLE "character_scores" ADD COLUMN "job_id" TEXT,
ADD COLUMN "job_grow_id" TEXT;

-- 지금까지 저장한 점수는 계산할 때의 전직을 남기지 않았으므로 지금 characters의 전직으로 채운다.
UPDATE "character_scores" AS score
SET "job_id" = character."job_id", "job_grow_id" = character."job_grow_id"
FROM "characters" AS character
WHERE character."server_id" = score."server_id" AND character."character_id" = score."character_id";

-- CreateIndex
CREATE INDEX "character_scores_kind_job_score_idx" ON "character_scores"("kind", "job_id", "job_grow_id", "score" DESC, "server_id", "character_id");

COMMIT;
