import { forwardCause } from '@dfragon/lib/error-chain'
import { type NeopleClient, NeopleRequestFailure } from '@dfragon/neople'
import type { FetchLowestListing } from '#application/soul-prices/ports.js'
import { SoulPriceFailure } from '#domain/soul-prices/index.js'

// 문서가 unitPrice 정렬 값의 형식을 예시로 보여 주지 않아, 정렬이 무시돼도 최저가를 고르게 여러 행을 받아 직접 비교한다.
const LISTING_LIMIT = 50

export function createNeopleLowestListing(neople: NeopleClient): FetchLowestListing {
  return async (itemName) => {
    try {
      const { rows } = await neople.auction({
        itemName,
        wordType: 'match',
        sort: 'unitPrice:asc',
        limit: LISTING_LIMIT
      })
      const lowest = rows
        .filter((row) => row.itemName === itemName)
        .reduce<(typeof rows)[number] | null>((current, row) => {
          if (current === null || row.unitPrice < current.unitPrice) {
            return row
          }

          return current
        }, null)

      if (lowest === null) {
        return null
      }

      const itemRarity = lowest.itemRarity ?? null

      return { itemRarity, unitPrice: lowest.unitPrice }
    } catch (error) {
      if (error instanceof NeopleRequestFailure) {
        throw new SoulPriceFailure(error.kind, forwardCause(error))
      }

      throw new SoulPriceFailure('api', { cause: error })
    }
  }
}
