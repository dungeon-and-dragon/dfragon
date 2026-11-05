import type { ApiOptions } from '../search/character-http'
import { SearchHttpFailure } from '../search/http'
import { createJsonRequest } from '../ranking/ranking-stats-http'
import { adventureWeeklySchema, type AdventureWeekly } from './adventure-weekly'

// 모험단 캐릭터 수십 명에 이름별 클리어 몇 개라 응답은 수십 KB다.
const ADVENTURE_WEEKLY_JSON_BYTES = 256 * 1024

export type AdventureWeeklyHttp = (adventureName: string) => Promise<AdventureWeekly>

export function createAdventureWeeklyHttp(options: ApiOptions): AdventureWeeklyHttp {
  return (adventureName) => {
    if (adventureName.trim() === '') {
      return Promise.reject(new SearchHttpFailure('INVALID_SEARCH_QUERY'))
    }

    const request = createJsonRequest(
      options,
      `/adventures/${encodeURIComponent(adventureName)}/weekly`,
      adventureWeeklySchema,
      ADVENTURE_WEEKLY_JSON_BYTES
    )

    return request()
  }
}
