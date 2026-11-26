import type { DatabaseClient } from './client.js'

export type AuctionPriceEntry = {
  itemName: string
  itemId: string | null
  itemRarity: string | null
  unitPrice: number | null
  checkedAt: Date
}

export type LabItemPriceTarget = {
  itemName: string
  exchanged: boolean
}

// 같은 이름이 여러 묶음에 있으면, 한 묶음에서라도 재화 비용을 붙인 이름은 경매장에서 찾지 않는다.
export async function readLabItemPriceTargets(
  client: DatabaseClient
): Promise<LabItemPriceTarget[]> {
  return client.$queryRaw<LabItemPriceTarget[]>`
    SELECT "item_name" AS "itemName", bool_or("currency_id" IS NOT NULL) AS "exchanged"
    FROM "lab_items"
    GROUP BY "item_name"
    ORDER BY "item_name"`
}

export async function recordAuctionPrice(
  client: DatabaseClient,
  { itemName, itemId, itemRarity, unitPrice, checkedAt }: AuctionPriceEntry
): Promise<void> {
  const storedUnitPrice = unitPrice !== null ? BigInt(unitPrice) : null
  const price = { itemId, itemRarity, unitPrice: storedUnitPrice, checkedAt }

  await client.auctionPrice.upsert({
    where: { itemName },
    create: { itemName, ...price },
    update: price
  })
}
