BEGIN;

-- 운영 app이 queue 현황을 timeline_sync_requests에서 세므로 이 테이블을 쓰거나 읽는 곳이 없다.
DROP TABLE IF EXISTS "timeline_queue_counts";

COMMIT;
