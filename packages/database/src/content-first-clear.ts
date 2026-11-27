import type { DatabaseClient } from './client.js'
import type { Prisma } from './generated/prisma/client.js'
import type { TimelineCharacter, TimelineRange } from './timeline.js'

export type ContentFirstClear = {
  kind: string
  name: string
  firstClearedAt: Date
}

export function readContentFirstClears(client: DatabaseClient): Promise<ContentFirstClear[]> {
  return client.contentFirstClear.findMany({
    select: { kind: true, name: true, firstClearedAt: true }
  })
}

// 이름은 migration의 처음 값 채우기와 같은 기준이다. 이미 같거나 더 이른 시각이 있는 이름은 고르지 않아,
// 늦은 기록을 저장하는 대부분의 교체가 다른 캐릭터의 교체와 같은 행을 잠그고 기다리지 않는다.
export async function recordContentFirstClears(
  transaction: Prisma.TransactionClient,
  { serverId, characterId }: TimelineCharacter,
  range: TimelineRange
): Promise<void> {
  await transaction.$executeRaw`
    INSERT INTO "content_first_clears" ("kind", "name", "first_cleared_at")
    SELECT "clear"."kind", "clear"."name", "clear"."first_cleared_at"
    FROM (
      SELECT "kind", "name", min("occurred_at") AS "first_cleared_at"
      FROM (
        SELECT
          CASE WHEN "code" = 209 THEN 'legion' ELSE 'raid' END AS "kind",
          CASE WHEN "code" = 209 THEN "data"->>'regionName' ELSE "raid_name" END AS "name",
          "occurred_at"
        FROM "timeline_events"
        WHERE "server_id" = ${serverId}
          AND "character_id" = ${characterId}
          AND "code" IN (201, 209, 210)
          AND "occurred_at" BETWEEN ${range.start}::timestamptz AND ${range.end}::timestamptz
      ) AS "event"
      WHERE "name" <> ''
      GROUP BY "kind", "name"
    ) AS "clear"
    LEFT JOIN "content_first_clears" AS "stored"
      ON "stored"."kind" = "clear"."kind" AND "stored"."name" = "clear"."name"
    WHERE "stored"."first_cleared_at" IS NULL
      OR "clear"."first_cleared_at" < "stored"."first_cleared_at"
    ORDER BY "clear"."kind", "clear"."name"
    ON CONFLICT ("kind", "name") DO UPDATE
      SET "first_cleared_at" = LEAST("content_first_clears"."first_cleared_at", EXCLUDED."first_cleared_at")`
}
