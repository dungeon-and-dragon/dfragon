BEGIN;

CREATE TABLE "content_first_clears" (
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "first_cleared_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "content_first_clears_pkey" PRIMARY KEY ("kind", "name"),
    CONSTRAINT "content_first_clears_kind_check" CHECK ("kind" IN ('raid', 'legion'))
);

-- 레이드 클리어(201)와 선발대(210)는 raid_name, 레기온 클리어(209)는 data.regionName이 이름이다.
-- 선발대가 본 레이드보다 먼저 나와 함께 본다. 운영 기록 2,100만 행에서 이 SELECT가 약 8초였다.
INSERT INTO "content_first_clears" ("kind", "name", "first_cleared_at")
SELECT "kind", "name", min("occurred_at")
FROM (
    SELECT
        CASE WHEN "code" = 209 THEN 'legion' ELSE 'raid' END AS "kind",
        CASE WHEN "code" = 209 THEN "data"->>'regionName' ELSE "raid_name" END AS "name",
        "occurred_at"
    FROM "timeline_events"
    WHERE "code" IN (201, 209, 210)
) AS "clear"
WHERE "name" <> ''
GROUP BY "kind", "name";

COMMIT;
