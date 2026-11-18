import type { DatabaseClient } from './client.js'

export type ItemDictionaryEntry = {
  itemId: string
  availableLevel: number | null
  itemType: string | null
}

export type UnlistedAcquisitionQuery = {
  codes: readonly number[]
  itemRarities: readonly string[]
  since: Date
}

export async function readItemDictionary(
  client: DatabaseClient,
  itemIds: readonly string[]
): Promise<ItemDictionaryEntry[]> {
  return client.item.findMany({
    where: { itemId: { in: [...new Set(itemIds)] } },
    select: { itemId: true, availableLevel: true, itemType: true }
  })
}

export async function readUnlistedItemIds(
  client: DatabaseClient,
  itemIds: readonly string[]
): Promise<string[]> {
  const listed = await client.item.findMany({
    where: { itemId: { in: [...itemIds] } },
    select: { itemId: true }
  })
  const listedIds = new Set(listed.map(({ itemId }) => itemId))

  return [...new Set(itemIds)].filter((itemId) => !listedIds.has(itemId))
}

// 같은 itemId를 두 동기화가 함께 채울 수 있어, 먼저 저장한 행을 남긴다.
export async function recordItemDictionary(
  client: DatabaseClient,
  entries: readonly ItemDictionaryEntry[]
): Promise<void> {
  await client.item.createMany({ data: [...entries], skipDuplicates: true })
}

export async function readUnlistedAcquisitionItemIds(
  client: DatabaseClient,
  { codes, itemRarities, since }: UnlistedAcquisitionQuery
): Promise<string[]> {
  const rows = await client.$queryRaw<{ itemId: string }[]>`
    SELECT DISTINCT timeline."item_id" AS "itemId"
    FROM "timeline_items" timeline
    WHERE timeline."code" = ANY(${[...codes]}::int[])
      AND timeline."item_rarity" = ANY(${[...itemRarities]}::text[])
      AND timeline."occurred_at" >= ${since}
      AND timeline."item_id" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "items" item WHERE item."item_id" = timeline."item_id")
    ORDER BY "itemId"
  `

  return rows.map(({ itemId }) => itemId)
}
