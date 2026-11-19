import { Prisma } from './generated/prisma/client.js'
import type { DatabaseClient } from './client.js'

export type ItemDictionaryEntry = {
  itemId: string
  availableLevel: number | null
  itemType: string | null
  itemTypeDetail: string | null
  itemRarity: string | null
  setItemId: string | null
  setItemName: string | null
}

export type UnlistedAcquisitionQuery = {
  equipmentCodes: readonly number[]
  equipmentRarities: readonly string[]
  oathCodes: readonly number[]
  since: Date
}

// 종류는 있는데 등급이 빈 행은 세트, 부위, 등급 열을 더하기 전에 채운 행이라 아직 채우지 않은 행으로 본다.
// Neople이 모르는 itemId의 행은 종류도 비어 다시 묻지 않는다.
const filledItem = { OR: [{ itemType: null }, { itemRarity: { not: null } }] }
const unfilledItemSql = Prisma.sql`item."item_type" IS NOT NULL AND item."item_rarity" IS NULL`

export async function readItemDictionary(
  client: DatabaseClient,
  itemIds: readonly string[]
): Promise<ItemDictionaryEntry[]> {
  return client.item.findMany({
    where: { itemId: { in: [...new Set(itemIds)] } },
    select: {
      itemId: true,
      availableLevel: true,
      itemType: true,
      itemTypeDetail: true,
      itemRarity: true,
      setItemId: true,
      setItemName: true
    }
  })
}

export async function readUnlistedItemIds(
  client: DatabaseClient,
  itemIds: readonly string[]
): Promise<string[]> {
  const listed = await client.item.findMany({
    where: { itemId: { in: [...itemIds] }, ...filledItem },
    select: { itemId: true }
  })
  const listedIds = new Set(listed.map(({ itemId }) => itemId))

  return [...new Set(itemIds)].filter((itemId) => !listedIds.has(itemId))
}

// 같은 itemId를 두 동기화가 함께 채울 수 있어, 먼저 채운 행을 남기고 아직 채우지 않은 행만 바꾼다.
// Neople이 행을 주지 않은 응답으로는 옛 행의 레벨과 종류를 지우지 않고, 다음 채우기에서 다시 묻는다.
export async function recordItemDictionary(
  client: DatabaseClient,
  entries: readonly ItemDictionaryEntry[]
): Promise<void> {
  const column = <Key extends keyof ItemDictionaryEntry>(key: Key) =>
    entries.map((entry) => entry[key])

  await client.$executeRaw`
    INSERT INTO "items" AS item (
      "item_id", "available_level", "item_type", "item_type_detail", "item_rarity",
      "set_item_id", "set_item_name"
    )
    SELECT * FROM unnest(
      ${column('itemId')}::text[],
      ${column('availableLevel')}::int[],
      ${column('itemType')}::text[],
      ${column('itemTypeDetail')}::text[],
      ${column('itemRarity')}::text[],
      ${column('setItemId')}::text[],
      ${column('setItemName')}::text[]
    )
    ON CONFLICT ("item_id") DO UPDATE SET
      "available_level" = EXCLUDED."available_level",
      "item_type" = EXCLUDED."item_type",
      "item_type_detail" = EXCLUDED."item_type_detail",
      "item_rarity" = EXCLUDED."item_rarity",
      "set_item_id" = EXCLUDED."set_item_id",
      "set_item_name" = EXCLUDED."set_item_name",
      "fetched_at" = CURRENT_TIMESTAMP
    WHERE ${unfilledItemSql} AND EXCLUDED."item_type" IS NOT NULL
  `
}

export async function readUnlistedAcquisitionItemIds(
  client: DatabaseClient,
  { equipmentCodes, equipmentRarities, oathCodes, since }: UnlistedAcquisitionQuery
): Promise<string[]> {
  const rows = await client.$queryRaw<{ itemId: string }[]>`
    SELECT DISTINCT timeline."item_id" AS "itemId"
    FROM "timeline_items" timeline
    WHERE (
        (timeline."code" = ANY(${[...equipmentCodes]}::int[])
          AND timeline."item_rarity" = ANY(${[...equipmentRarities]}::text[]))
        OR timeline."code" = ANY(${[...oathCodes]}::int[])
      )
      AND timeline."occurred_at" >= ${since}
      AND timeline."item_id" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "items" item
        WHERE item."item_id" = timeline."item_id" AND NOT (${unfilledItemSql})
      )
    ORDER BY "itemId"
  `

  return rows.map(({ itemId }) => itemId)
}
