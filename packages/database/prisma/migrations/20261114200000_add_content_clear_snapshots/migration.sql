BEGIN;

-- 클리어를 처음 저장할 때 캐릭터의 최고 명성과 점수를 복사해 두는 칸이다. 이 migration 전에 저장한 행은 비어 있다.
ALTER TABLE "content_clears"
    ADD COLUMN "max_fame" INTEGER,
    ADD COLUMN "score" INTEGER,
    ADD COLUMN "score_kind" TEXT,
    ADD COLUMN "score_engine_package" TEXT,
    ADD COLUMN "score_engine_rules_rev" TEXT,
    ADD COLUMN "score_engine_bundle_id" TEXT;

COMMIT;
