import type { NeopleClient } from '@dfragon/neople'
import type {
  AuctionListing,
  FetchLowestLevelListing,
  FetchLowestListing
} from '#application/auction-prices/ports.js'

// 문서가 unitPrice 정렬 값의 형식을 예시로 보여 주지 않아, 정렬이 무시돼도 최저가를 고르게 여러 행을 받아 직접 비교한다.
const LISTING_LIMIT = 50
// 앞부분 검색에는 같은 앞부분을 쓰는 다른 아이템도 섞여 나와, Neople이 받는 최대 행 수를 받는다.
const LEVEL_LISTING_LIMIT = 400
const LEVEL_TAG_PATTERN = /\[\d+Lv\]/g
const WHITESPACE_RUN_PATTERN = /\s+/g
const CREATURE_TYPE_DETAIL = '크리쳐'
const EGG_SUFFIXES = [' 알', '의 알']

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

// 꼬리표는 칭호처럼 이름 끝(`이름[45Lv]`)에도, 크리쳐처럼 마지막 단어 앞(`이름[45Lv] 알`)에도 붙는다.
function isLevelVariant(rowName: string, itemName: string): boolean {
  const tags = rowName.match(LEVEL_TAG_PATTERN) ?? []

  if (tags.length !== 1) {
    return false
  }

  const untagged = rowName
    .replace(LEVEL_TAG_PATTERN, ' ')
    .replace(WHITESPACE_RUN_PATTERN, ' ')
    .trim()

  return untagged === itemName
}

// 크리쳐는 경매장에 본체가 아니라 알로만 올라, 본체 이름에 알을 붙인 매물을 받는다.
// 꼬리표가 있는 본체는 레벨마다 후보가 따로 있어, 같은 꼬리표가 붙은 알만 받는다.
function isEggVariant(rowName: string, itemName: string): boolean {
  if (EGG_SUFFIXES.some((suffix) => rowName === `${itemName}${suffix}`)) {
    return true
  }

  const tagged = (itemName.match(LEVEL_TAG_PATTERN) ?? []).length > 0

  if (tagged) {
    return false
  }

  return isLevelVariant(rowName, `${itemName} 알`)
}

// 앞부분 검색어는 꼬리표 앞까지여야 해서, 이름 전체로 찾지 못하면 마지막 단어를 뺀 앞부분으로 한 번 더 찾는다.
function levelSearchWords(itemName: string): string[] {
  const lastSpace = itemName.lastIndexOf(' ')

  if (lastSpace === -1) {
    return [itemName]
  }

  return [itemName, itemName.slice(0, lastSpace)]
}

function isLevelTarget(
  row: AuctionRow,
  itemName: string,
  itemTypeDetails: readonly string[]
): boolean {
  if (row.itemTypeDetail === undefined || !itemTypeDetails.includes(row.itemTypeDetail)) {
    return false
  }

  if (isLevelVariant(row.itemName, itemName)) {
    return true
  }

  return row.itemTypeDetail === CREATURE_TYPE_DETAIL && isEggVariant(row.itemName, itemName)
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
    for (const searchWord of levelSearchWords(itemName)) {
      const { rows } = await neople.auction({
        itemName: searchWord,
        wordType: 'front',
        sort: 'unitPrice:asc',
        limit: LEVEL_LISTING_LIMIT
      })

      const listing = selectLowestListing(rows, (row) =>
        isLevelTarget(row, itemName, itemTypeDetails)
      )

      if (listing !== null) {
        return listing
      }
    }

    return null
  }
}
