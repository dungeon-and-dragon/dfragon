BEGIN;

-- 강화 백필이 캐릭터명, 모험단명 변경(102, 105)도 받게 되어, 이미 받은 캐릭터도 다음 상세 조회 때 처음부터 다시 받게 한다.
UPDATE "timeline_sync_state"
SET "enhancement_backfilled_until" = NULL
WHERE "enhancement_backfilled_until" IS NOT NULL;

COMMIT;
