import type { NeopleClient } from '@dfragon/neople'
import type { AuctionListing, FetchLowestListing } from '#application/auction-prices/ports.js'

// 문서가 unitPrice 정렬 값의 형식을 예시로 보여 주지 않아, 정렬이 무시돼도 최저가를 고르게 여러 행을 받아 직접 비교한다.
const LISTING_LIMIT = 50

type AuctionRow = Awaited<ReturnType<NeopleClient['auction']>>['rows'][number]

function selectLowestListing(rows: readonly AuctionRow[], itemName: string): AuctionListing | null {
  const lowest = rows
    .filter((row) => row.itemName === itemName)
    .reduce<AuctionRow | null>((current, row) => {
      if (current === null || row.unitPrice < current.unitPrice) {
        return row
      }

      return current
    }, null)

  if (lowest === null) {
    return null
  }

  const itemRarity = lowest.itemRarity ?? null

  return { itemId: lowest.itemId, itemRarity, unitPrice: lowest.unitPrice }
}

export function createNeopleLowestListing(
  neople: Pick<NeopleClient, 'auction'>
): FetchLowestListing {
  return async (itemName) => {
    const { rows } = await neople.auction({
      itemName,
      wordType: 'match',
      sort: 'unitPrice:asc',
      limit: LISTING_LIMIT
    })

    return selectLowestListing(rows, itemName)
  }
}
