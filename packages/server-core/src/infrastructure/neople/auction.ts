import type { NeopleClient } from '@dfragon/neople'
import type {
  AuctionListing,
  FetchLowestLevelListing,
  FetchLowestListing
} from '#application/auction-prices/ports.js'

// 문서가 unitPrice 정렬 값의 형식을 예시로 보여 주지 않아, 정렬이 무시돼도 최저가를 고르게 여러 행을 받아 직접 비교한다.
const LISTING_LIMIT = 50
// 앞부분 검색에는 꼬리표 없는 같은 이름 매물도 섞여 나와, Neople이 받는 최대 행 수를 받는다.
const LEVEL_LISTING_LIMIT = 400
const LEVEL_SUFFIX_PATTERN = /^\[\d+Lv\]$/

type AuctionRow = Awaited<ReturnType<NeopleClient['auction']>>['rows'][number]

function selectLowestListing(
  rows: readonly AuctionRow[],
  isTarget: (row: AuctionRow) => boolean
): AuctionListing | null {
  const lowest = rows.filter(isTarget).reduce<AuctionRow | null>((current, row) => {
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

function isLevelVariant(rowName: string, itemName: string): boolean {
  if (!rowName.startsWith(itemName)) {
    return false
  }

  return LEVEL_SUFFIX_PATTERN.test(rowName.slice(itemName.length))
}

function isLevelTarget(
  row: AuctionRow,
  itemName: string,
  itemTypeDetails: readonly string[]
): boolean {
  if (row.itemTypeDetail === undefined || !itemTypeDetails.includes(row.itemTypeDetail)) {
    return false
  }

  return isLevelVariant(row.itemName, itemName)
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

    return selectLowestListing(rows, (row) => row.itemName === itemName)
  }
}

export function createNeopleLowestLevelListing(
  neople: Pick<NeopleClient, 'auction'>
): FetchLowestLevelListing {
  return async (itemName, itemTypeDetails) => {
    const { rows } = await neople.auction({
      itemName,
      wordType: 'front',
      sort: 'unitPrice:asc',
      limit: LEVEL_LISTING_LIMIT
    })

    return selectLowestListing(rows, (row) => isLevelTarget(row, itemName, itemTypeDetails))
  }
}
