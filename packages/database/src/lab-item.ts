import type { DatabaseClient } from './client.js'

export type LabItemCost = {
  currencyId: number
  count: number
}

export type LabItemEntry = {
  itemName: string
  cost: LabItemCost | null
}

export type LabItemGroup = {
  category: string
  role: string
  tier: string
  items: LabItemEntry[]
}

export async function readLabItemGroups(client: DatabaseClient): Promise<LabItemGroup[]> {
  return client.$queryRaw<LabItemGroup[]>`
    SELECT
      "category", "role", "tier",
      json_agg(
        json_build_object(
          'itemName', "item_name",
          'cost', CASE
            WHEN "currency_id" IS NULL THEN NULL
            ELSE json_build_object('currencyId', "currency_id", 'count', "currency_count")
          END
        )
        ORDER BY "id"
      ) AS "items"
    FROM "lab_items"
    GROUP BY "category", "role", "tier"
    ORDER BY "category", "role", "tier"`
}

function costColumns(cost: LabItemCost | null) {
  if (cost === null) {
    return { currencyId: null, currencyCount: null }
  }

  const currencyId = BigInt(cost.currencyId)

  return { currencyId, currencyCount: cost.count }
}

// 묶음에 남는 이름은 지우지 않아 처음 고른 시각을 그대로 둔다.
export async function replaceLabItemGroup(
  client: DatabaseClient,
  { category, role, tier, items }: LabItemGroup
): Promise<void> {
  const itemNames = items.map(({ itemName }) => itemName)
  const rows = items.map(({ itemName, cost }) => {
    const columns = costColumns(cost)

    return { category, role, tier, itemName, ...columns }
  })
  const costUpdates = items.map(({ itemName, cost }) => {
    const data = costColumns(cost)

    return client.labItem.updateMany({ where: { category, role, tier, itemName }, data })
  })

  await client.$transaction([
    client.labItem.deleteMany({
      where: { category, role, tier, itemName: { notIn: itemNames } }
    }),
    client.labItem.createMany({ data: rows, skipDuplicates: true }),
    ...costUpdates
  ])
}

export type LabItemPriceCost = {
  currencyId: number
  currencyName: string
  currencyDescription: string | null
  currencyUpdatedAt: Date
  count: number
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
  cost: LabItemPriceCost | null
}

type StoredLabItemPriceRow = Omit<LabItemPriceRow, 'unitPrice' | 'cost'> & {
  unitPrice: bigint | null
  currencyId: bigint | null
  currencyName: string | null
  currencyDescription: string | null
  currencyUpdatedAt: Date | null
  currencyCount: number | null
}

function toPriceCost({
  currencyId,
  currencyName,
  currencyDescription,
  currencyUpdatedAt,
  currencyCount
}: StoredLabItemPriceRow): LabItemPriceCost | null {
  if (
    currencyId === null ||
    currencyName === null ||
    currencyUpdatedAt === null ||
    currencyCount === null
  ) {
    return null
  }

  const id = Number(currencyId)

  return {
    currencyId: id,
    currencyName,
    currencyDescription,
    currencyUpdatedAt,
    count: currencyCount
  }
}

// 가격은 foreign key 없이 아이템 이름으로만 잇고, 재화는 currency_id로 잇는다.
export async function readLabItemPrices(client: DatabaseClient): Promise<LabItemPriceRow[]> {
  const rows = await client.$queryRaw<StoredLabItemPriceRow[]>`
    SELECT
      i."category", i."role", i."tier", i."item_name" AS "itemName",
      p."item_id" AS "itemId", p."item_rarity" AS "itemRarity",
      p."unit_price" AS "unitPrice", p."checked_at" AS "checkedAt",
      c."id" AS "currencyId", c."name" AS "currencyName", c."description" AS "currencyDescription",
      c."updated_at" AS "currencyUpdatedAt", i."currency_count" AS "currencyCount"
    FROM "lab_items" i
    LEFT JOIN "auction_prices" p ON p."item_name" = i."item_name"
    LEFT JOIN "lab_currencies" c ON c."id" = i."currency_id"
    ORDER BY i."id"`

  return rows.map((row) => {
    const { category, role, tier, itemName, itemId, itemRarity, unitPrice, checkedAt } = row
    const price = unitPrice !== null ? Number(unitPrice) : null
    const cost = toPriceCost(row)

    return {
      category,
      role,
      tier,
      itemName,
      itemId,
      itemRarity,
      unitPrice: price,
      checkedAt,
      cost
    }
  })
}
