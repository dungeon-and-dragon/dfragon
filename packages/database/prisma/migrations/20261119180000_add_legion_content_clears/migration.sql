-- 레기온 클리어도 레이드처럼 주마다 한 행으로 저장한다.
-- 기존 행은 모두 raid, challenge라 다시 검사하지 않는다. API가 시작할 때 migration을 적용하므로, 6천만 행을 읽는
-- VALIDATE를 하면 그동안 API가 뜨지 않는다. NOT VALID 검사도 새로 넣거나 고치는 행은 검사한다.
BEGIN;

ALTER TABLE "content_clears"
    DROP CONSTRAINT "content_clears_kind_check",
    ADD CONSTRAINT "content_clears_kind_check" CHECK ("kind" IN ('raid', 'challenge', 'legion')) NOT VALID;

COMMIT;
