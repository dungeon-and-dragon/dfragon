BEGIN;

-- partition과 시즌 id를 게임의 시즌 번호(중천 10, 천해천 11)에 맞춘다. 이름만 바꾸므로 행은 옮기지 않는다.
ALTER TABLE "timeline_items_season_1" RENAME TO "timeline_items_season_10";
ALTER TABLE "timeline_items_season_2" RENAME TO "timeline_items_season_11";
UPDATE "seasons" SET "id" = 11 WHERE "id" = 2;
UPDATE "seasons" SET "id" = 10 WHERE "id" = 1;

-- 강화, 증폭, 재련 백필이 중천 전 행을 넣는다. Neople 타임라인은 2017-09-21 이후만 주므로 시즌 5 partition은 그날부터 둔다.
CREATE TABLE "timeline_items_season_5" PARTITION OF "timeline_items"
    FOR VALUES FROM ('2017-09-21 00:00:00+09') TO ('2018-08-09 06:00:00+09');

CREATE TABLE "timeline_items_season_6" PARTITION OF "timeline_items"
    FOR VALUES FROM ('2018-08-09 06:00:00+09') TO ('2020-01-09 06:00:00+09');

CREATE TABLE "timeline_items_season_7" PARTITION OF "timeline_items"
    FOR VALUES FROM ('2020-01-09 06:00:00+09') TO ('2022-03-17 06:00:00+09');

CREATE TABLE "timeline_items_season_8" PARTITION OF "timeline_items"
    FOR VALUES FROM ('2022-03-17 06:00:00+09') TO ('2023-09-14 06:00:00+09');

CREATE TABLE "timeline_items_season_9" PARTITION OF "timeline_items"
    FOR VALUES FROM ('2023-09-14 06:00:00+09') TO ('2025-01-09 06:00:00+09');

INSERT INTO "seasons" ("id", "name", "starts_at") VALUES
    (5, '마계', '2016-09-01 06:00:00+09'),
    (6, '할렘', '2018-08-09 06:00:00+09'),
    (7, '귀환', '2020-01-09 06:00:00+09'),
    (8, 'THE NEXT JOURNEY', '2022-03-17 06:00:00+09'),
    (9, '선계', '2023-09-14 06:00:00+09');

-- AlterTable
ALTER TABLE "timeline_sync_state" ADD COLUMN "enhancement_backfilled_until" TIMESTAMPTZ(3);

COMMIT;
