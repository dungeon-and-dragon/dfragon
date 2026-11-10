BEGIN;

-- 명성 상위 10만으로 마감한 주를 다시 열어 다음 수집이 최고 명성 기준 모집단으로 다시 받고 마감하게 한다.
UPDATE "content_clear_populations" SET "closed" = false WHERE "closed";

-- 끝나지 않은 수집의 처리한 캐릭터 수는 명성 상위 10만의 순서라, 새 모집단에서 이어 받으면 앞의 캐릭터를 건너뛴다.
DELETE FROM "content_clear_collections";

COMMIT;
