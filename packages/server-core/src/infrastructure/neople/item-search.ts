import type { NeopleClient } from '@dfragon/neople'
import type { FindItem } from '#application/auction-prices/ports.js'

const SEARCH_LIMIT = 10

export function createNeopleItemSearch(neople: Pick<NeopleClient, 'searchItems'>): FindItem {
  return async (itemName) => {
    const { rows } = await neople.searchItems({ itemName, wordType: 'match', limit: SEARCH_LIMIT })
    const found = rows.find((row) => row.itemName === itemName)

    if (found === undefined) {
      return null
    }

    return { itemId: found.itemId, itemRarity: found.itemRarity }
  }
}
