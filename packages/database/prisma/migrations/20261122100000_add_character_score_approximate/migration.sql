BEGIN;

-- AlterTable
ALTER TABLE "character_scores" ADD COLUMN "approximate_source" TEXT;

-- AlterTable
ALTER TABLE "character_score_history" ADD COLUMN "approximate_source" TEXT,
ADD COLUMN "approximate_warning" TEXT,
ADD COLUMN "skipped_kind" TEXT,
ADD COLUMN "skipped_message" TEXT;

-- 근사 정보는 엔진 결과에서 함께 오므로, 일부만 채운 행이 정확한 점수로 읽히지 않게 막는다.
ALTER TABLE "character_score_history" ADD CONSTRAINT "character_score_history_approximate_check" CHECK (
  ("approximate_source" IS NULL AND "approximate_warning" IS NULL AND "skipped_kind" IS NULL AND "skipped_message" IS NULL)
  OR ("approximate_source" IS NOT NULL AND "approximate_warning" IS NOT NULL AND "skipped_kind" IS NOT NULL AND "skipped_message" IS NOT NULL)
);

COMMIT;
