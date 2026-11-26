import type { DatabaseClient } from './client.js'

export type AuctionPriceEntry = {
  itemName: string
  itemId: string | null
  itemRarity: string | null
  unitPrice: number | null
  checkedAt: Date
}

export async function readLabItemNames(client: DatabaseClient): Promise<string[]> {
  const rows = await client.labItem.findMany({
    distinct: ['itemName'],
    select: { itemName: true },
    orderBy: { itemName: 'asc' }
  })

  return rows.map(({ itemName }) => itemName)
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
