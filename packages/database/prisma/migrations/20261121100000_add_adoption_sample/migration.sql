-- 세트, 아이템 선택 비율을 표본(전체, 권장 명성 이상, 범위별 명성 상위)마다 따로 저장한다.
-- 기존 행은 모두 전체 표본이라 기본값으로 채우고, 표본을 모르는 worker가 넣는 행도 전체 표본으로 남게 기본값을 둔다.
BEGIN;

ALTER TABLE "set_adoption"
    ADD COLUMN "sample" TEXT NOT NULL DEFAULT 'all',
    ADD CONSTRAINT "set_adoption_sample_check"
        CHECK ("sample" IN ('all', 'fame', 'top_all', 'top_job', 'top_grow', 'top_role'));

DROP INDEX "set_adoption_job_id_job_grow_id_role_idx";

CREATE INDEX "set_adoption_sample_job_id_job_grow_id_role_idx" ON "set_adoption"("sample", "job_id", "job_grow_id", "role");

ALTER TABLE "item_adoption"
    ADD COLUMN "sample" TEXT NOT NULL DEFAULT 'all',
    ADD CONSTRAINT "item_adoption_sample_check"
        CHECK ("sample" IN ('all', 'fame', 'top_all', 'top_job', 'top_grow', 'top_role'));

DROP INDEX "item_adoption_job_id_job_grow_id_role_idx";

CREATE INDEX "item_adoption_sample_job_id_job_grow_id_role_idx" ON "item_adoption"("sample", "job_id", "job_grow_id", "role");

COMMIT;
