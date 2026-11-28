import type { DatabaseClient } from './client.js'

// 크리쳐는 Neople 응답에 부위가 없어 CREATURE로 둔다.
export const LAB_CANDIDATE_WEAR_SLOT_IDS = ['TITLE', 'AURORA', 'CREATURE']

// 세트를 받은 합성 캐릭터 100만 명과 아이템 380만 행(세 부위 280만 행, PostgreSQL 18)에서 교체 transaction이 약 0.6초 걸렸다.
// 운영 장비와 설정 차이를 감안해 넉넉히 둔다.
const REPLACE_TIMEOUT_MS = 60_000

export async function replaceLabCandidateWearCounts(
  client: DatabaseClient,
  computedAt: Date
): Promise<number> {
  return client.$transaction(
    async (transaction) => {
      // TRUNCATE는 commit까지 읽기도 막으므로, 계산하는 동안 운영 app이 이전 저장분을 읽도록 DELETE로 지운다.
      await transaction.$executeRaw`DELETE FROM "lab_candidate_wear_counts"`

      return transaction.$executeRaw`
        INSERT INTO "lab_candidate_wear_counts" ("item_name", "slot_id", "count", "computed_at")
        SELECT "item_name", "slot_id", count(*)::int, ${computedAt}
        FROM "character_items"
        WHERE "slot_id" = ANY(${LAB_CANDIDATE_WEAR_SLOT_IDS}::text[])
        GROUP BY 1, 2`
    },
    { timeout: REPLACE_TIMEOUT_MS }
  )
}

export type WornItemId = {
  itemName: string
  itemId: string
}

// 같은 이름에 Neople id가 여럿이면(기간제, 이벤트 판) 가장 많이 낀 id를 고르고, 수가 같으면 id 순으로 정한다.
export async function readMostWornItemIds(
  client: DatabaseClient,
  itemNames: readonly string[]
): Promise<WornItemId[]> {
  if (itemNames.length === 0) {
    return []
  }

  return client.$queryRaw<WornItemId[]>`
    SELECT DISTINCT ON ("item_name") "item_name" AS "itemName", "item_id" AS "itemId"
    FROM "character_items"
    WHERE "slot_id" = ANY(${LAB_CANDIDATE_WEAR_SLOT_IDS}::text[])
      AND "item_name" = ANY(${[...itemNames]}::text[])
    GROUP BY "item_name", "item_id"
    ORDER BY "item_name", count(*) DESC, "item_id"`
}
