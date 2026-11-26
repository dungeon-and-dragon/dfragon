import type { DatabaseClient } from './client.js'

export type LabItemGroup = {
  category: string
  role: string
  tier: string
  itemNames: string[]
}

export async function readLabItemGroups(client: DatabaseClient): Promise<LabItemGroup[]> {
  return client.$queryRaw<LabItemGroup[]>`
    SELECT "category", "role", "tier", array_agg("item_name" ORDER BY "id") AS "itemNames"
    FROM "lab_items"
    GROUP BY "category", "role", "tier"
    ORDER BY "category", "role", "tier"`
}

// 묶음에 남는 이름은 지우지 않아 처음 고른 시각을 그대로 둔다.
export async function replaceLabItemGroup(
  client: DatabaseClient,
  { category, role, tier, itemNames }: LabItemGroup
): Promise<void> {
  const rows = itemNames.map((itemName) => ({ category, role, tier, itemName }))
  await client.$transaction([
    client.labItem.deleteMany({
      where: { category, role, tier, itemName: { notIn: itemNames } }
    }),
    client.labItem.createMany({ data: rows, skipDuplicates: true })
  ])
}

export type LabItemPriceRow = {
  category: string
  role: string
  tier: string
  itemName: string
  itemId: string | null
  itemRarity: string | null
  unitPrice: number | null
  checkedAt: Date | null
}

type StoredLabItemPriceRow = Omit<LabItemPriceRow, 'unitPrice'> & { unitPrice: bigint | null }

// 두 테이블은 foreign key 없이 아이템 이름으로만 잇는다.
export async function readLabItemPrices(client: DatabaseClient): Promise<LabItemPriceRow[]> {
  const rows = await client.$queryRaw<StoredLabItemPriceRow[]>`
    SELECT
      i."category", i."role", i."tier", i."item_name" AS "itemName",
      p."item_id" AS "itemId", p."item_rarity" AS "itemRarity",
      p."unit_price" AS "unitPrice", p."checked_at" AS "checkedAt"
    FROM "lab_items" i
    LEFT JOIN "auction_prices" p ON p."item_name" = i."item_name"
    ORDER BY i."id"`

  return rows.map(({ unitPrice, ...row }) => {
    const price = unitPrice !== null ? Number(unitPrice) : null

    return { ...row, unitPrice: price }
  })
}
