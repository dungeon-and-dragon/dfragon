import { forwardCause } from '@dfragon/lib/error-chain'
import { type NeopleClient, NeopleRequestFailure } from '@dfragon/neople'
import { createNeopleLowestListing as createLowestListing } from '@dfragon/server-core/infrastructure/neople/index.js'
import type { FetchLowestListing } from '#application/soul-prices/ports.js'
import { SoulPriceFailure } from '#domain/soul-prices/index.js'

export function createNeopleLowestListing(neople: NeopleClient): FetchLowestListing {
  const fetchLowestListing = createLowestListing(neople)

  return async (itemName) => {
    try {
      return await fetchLowestListing(itemName)
    } catch (error) {
      if (error instanceof NeopleRequestFailure) {
        throw new SoulPriceFailure(error.kind, forwardCause(error))
      }

      throw new SoulPriceFailure('api', { cause: error })
    }
  }
}
