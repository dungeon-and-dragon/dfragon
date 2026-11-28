import type { DatabaseClient } from './client.js'
import {
  type SetAdoptionQuery,
  type SetAdoptionReplacement,
  adoptionConditions,
  sampledCharactersSql
} from './set-adoption.js'

export type ItemCount = {
  itemId: string
  name: string
  typeDetail: string | null
  count: number
}

export type SlotItemCounts = {
  slotId: string
  items: ItemCount[]
}

export type ItemAdoption = {
  computedAt: Date | null
  sampleSize: number
  slots: SlotItemCounts[]
}

// Neople 장비 응답의 부위 순서다. 무기가 먼저 오고, 목록에 없는 부위는 뒤에 부위 ID 순으로 둔다.
const SLOT_ORDER = [
  'WEAPON',
  'TITLE',
  'JACKET',
  'SHOULDER',
  'PANTS',
  'SHOES',
  'WAIST',
  'AMULET',
  'WRIST',
  'RING',
  'SUPPORT',
  'MAGIC_STON',
  'EARRING'
]

// 오라는 직업 통계가 보이지 않아 세지 않는다. 칭호, 크리쳐, 무기 아바타는 이름의 스킬 Lv을 직업 통계가 센다.
const AURA_SLOT_ID = 'AURORA'

// 세트를 받은 합성 캐릭터 70만 명(명성 117014 이상 40만 명)과 아이템 149만 행(PostgreSQL 18.7)에서 표본별 교체
// transaction이 약 15초 걸렸다. 운영 장비와 설정 차이를 감안해 열 배 넘게 둔다.
const REPLACE_TIMEOUT_MS = 180_000

/**
 * 부위 ID가 null인 행은 그 표본, 전직, 역할에서 세트 값을 받은 캐릭터 수다.
 * 유일 장비를 끼지 않은 캐릭터도 표본 수에 들어야 해서, 아이템 행과 같은 transaction에서 함께 센다.
 */
export async function replaceItemAdoption(
  client: DatabaseClient,
  { computedAt, maleCrusader }: SetAdoptionReplacement
): Promise<number> {
  const sampled = sampledCharactersSql(maleCrusader)

  // TRUNCATE는 commit까지 읽기도 막으므로, 계산하는 동안 API가 이전 저장분을 읽도록 DELETE로 지운다.

  return client.$transaction(
    async (transaction) => {
      await transaction.$executeRaw`DELETE FROM item_adoption`
      await transaction.$executeRaw`
        INSERT INTO item_adoption
          (sample, job_id, job_grow_id, role, slot_id, item_id, item_name, item_type_detail, count, computed_at)
        SELECT c.sample, c.job_id, c.job_grow_id, c.role, NULL, NULL, NULL, NULL, count(*)::int, ${computedAt}
        FROM ${sampled} c
        GROUP BY 1, 2, 3, 4`

      return transaction.$executeRaw`
        INSERT INTO item_adoption
          (sample, job_id, job_grow_id, role, slot_id, item_id, item_name, item_type_detail, count, computed_at)
        SELECT c.sample, c.job_id, c.job_grow_id, c.role, item.slot_id, item.item_id, item.item_name,
          item.item_type_detail, count(*)::int, ${computedAt}
        FROM ${sampled} c
        JOIN character_items item
          ON item.server_id = c.server_id AND item.character_id = c.character_id
            AND item.slot_id <> ${AURA_SLOT_ID}
        GROUP BY 1, 2, 3, 4, 5, 6, 7, 8`
    },
    { timeout: REPLACE_TIMEOUT_MS }
  )
}

// 같은 아이템 id에 이름이나 종류가 여럿이면 캐릭터가 가장 많은 값을 준다. 종류를 모르는 행만 있으면 종류는 null이다. 한 문장으로 읽어 job이 표를 바꾸는 중에도 같은 저장분에서 나온다.
export async function readItemAdoption(
  client: DatabaseClient,
  query: SetAdoptionQuery
): Promise<ItemAdoption> {
  const [adoption] = await client.$queryRaw<ItemAdoption[]>`
    WITH picked AS (
      SELECT * FROM item_adoption ${adoptionConditions(query)}
    ),
    item_names AS (
      SELECT slot_id, item_id, item_name, sum(count)::int AS count
      FROM picked WHERE slot_id IS NOT NULL GROUP BY 1, 2, 3
    ),
    item_types AS (
      SELECT slot_id, item_id, (array_agg(item_type_detail ORDER BY count DESC, item_type_detail))[1] AS type_detail
      FROM (
        SELECT slot_id, item_id, item_type_detail, sum(count)::int AS count
        FROM picked WHERE slot_id IS NOT NULL AND item_type_detail IS NOT NULL GROUP BY 1, 2, 3
      ) counted
      GROUP BY 1, 2
    ),
    items AS (
      SELECT slot_id, item_id, (array_agg(item_name ORDER BY count DESC, item_name))[1] AS name,
        sum(count)::int AS count
      FROM item_names GROUP BY 1, 2
    ),
    slots AS (
      SELECT items.slot_id,
        jsonb_agg(jsonb_build_object('itemId', items.item_id, 'name', items.name,
          'typeDetail', item_types.type_detail, 'count', items.count)
          ORDER BY items.count DESC, items.item_id) AS items
      FROM items
      LEFT JOIN item_types ON item_types.slot_id = items.slot_id AND item_types.item_id = items.item_id
      GROUP BY 1
    )
    SELECT
      (SELECT max(computed_at) FROM item_adoption) AS "computedAt",
      (SELECT COALESCE(sum(count), 0)::int FROM picked WHERE slot_id IS NULL) AS "sampleSize",
      (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('slotId', slot_id, 'items', items)
          ORDER BY COALESCE(array_position(${SLOT_ORDER}::text[], slot_id), ${SLOT_ORDER.length + 1}), slot_id), '[]'::jsonb)
        FROM slots
      ) AS slots`

  return adoption
}
