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
  categories: string[]
}

// 같은 이름이 여러 묶음에 있으면, 한 묶음에서라도 재화 비용을 붙인 이름은 경매장에서 찾지 않는다.
export async function readLabItemPriceTargets(
  client: DatabaseClient
): Promise<LabItemPriceTarget[]> {
  return client.$queryRaw<LabItemPriceTarget[]>`
    SELECT
      "item_name" AS "itemName",
      bool_or("currency_id" IS NOT NULL) AS "exchanged",
      array_agg(DISTINCT "category" ORDER BY "category") AS "categories"
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

  // 최신 가격 행의 잠금을 먼저 잡아 같은 이름의 이력 판단과 저장을 직렬화한다.
  await client.$transaction([
    client.auctionPrice.upsert({
      where: { itemName },
      create: { itemName, ...price },
      update: price
    }),
    client.$executeRaw`
      INSERT INTO "auction_price_history" ("item_name", "item_id", "unit_price", "checked_at")
      SELECT ${itemName}, ${itemId}, ${storedUnitPrice}::bigint, ${checkedAt}
      WHERE NOT EXISTS (
        SELECT 1 FROM (
          SELECT "item_id", "unit_price", "checked_at"
          FROM "auction_price_history"
          WHERE "item_name" = ${itemName}
          ORDER BY "checked_at" DESC, "id" DESC
          LIMIT 1
        ) last
        WHERE last."item_id" IS NOT DISTINCT FROM ${itemId}
          AND last."unit_price" IS NOT DISTINCT FROM ${storedUnitPrice}::bigint
          AND last."checked_at" > ${checkedAt}::timestamptz - INTERVAL '24 hours'
      )`
  ])
}

export type AuctionPriceHistoryEntry = {
  id: number
  itemName: string
  itemId: string | null
  unitPrice: number | null
  checkedAt: Date
}

export async function readAuctionPriceHistory(
  client: DatabaseClient,
  itemName: string
): Promise<AuctionPriceHistoryEntry[]> {
  const rows = await client.auctionPriceHistory.findMany({
    where: { itemName },
    orderBy: [{ checkedAt: 'desc' }, { id: 'desc' }]
  })

  return rows.map(({ id, unitPrice, ...row }) => {
    const historyId = Number(id)
    const price = unitPrice !== null ? Number(unitPrice) : null

    return { ...row, id: historyId, unitPrice: price }
  })
}

export async function deleteAuctionPriceHistoryBefore(
  client: DatabaseClient,
  before: Date
): Promise<number> {
  const { count } = await client.auctionPriceHistory.deleteMany({
    where: { checkedAt: { lt: before } }
  })

  return count
}
