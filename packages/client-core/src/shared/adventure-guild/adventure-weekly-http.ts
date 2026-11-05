import type { ApiOptions } from '../search/character-http'
import { SearchHttpFailure } from '../search/http'
import { createJsonRequest } from '../ranking/ranking-stats-http'
import { adventureWeeklySchema, type AdventureWeekly } from './adventure-weekly'

export type AdventureWeeklyHttp = (adventureName: string) => Promise<AdventureWeekly>

export function createAdventureWeeklyHttp(options: ApiOptions): AdventureWeeklyHttp {
  return (adventureName) => {
    if (adventureName.trim() === '') {
      return Promise.reject(new SearchHttpFailure('INVALID_SEARCH_QUERY'))
    }

    const request = createJsonRequest(
      options,
      `/adventures/${encodeURIComponent(adventureName)}/weekly`,
      adventureWeeklySchema
    )

    return request()
  }
}
