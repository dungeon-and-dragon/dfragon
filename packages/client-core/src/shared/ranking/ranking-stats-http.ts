import { SearchHttpFailure } from '../search/http'
import { assertApiSuccess, type ApiOptions } from '../search/character-http'
import {
  createCharacterHttpClient,
  parseCharacterJson,
  throwCharacterTransportFailure
} from '../search/character-response'
import type { z } from 'zod'
import {
  characterStatsSchema,
  fameRankingSchema,
  type CharacterStats,
  type FameRanking,
  type FameRankingFilter
} from './ranking-stats'

export type FameRankingHttp = (filter: FameRankingFilter) => Promise<FameRanking>
export type CharacterStatsHttp = () => Promise<CharacterStats>

export function createJsonRequest<Schema extends z.ZodType>(
  { apiOrigin, fetch: transport }: ApiOptions,
  path: string,
  schema: Schema
): (searchParams?: Record<string, string>) => Promise<z.infer<Schema>> {
  const client = createCharacterHttpClient(transport)

  return async (searchParams) => {
    try {
      const request = client.get(`${apiOrigin}${path}`, {
        searchParams,
        headers: { Accept: 'application/json' }
      })
      const response = await request
      // ky의 body 메서드만 본문 읽기에도 timeout을 건다.
      const body = parseCharacterJson(await request.arrayBuffer())
      assertApiSuccess(response, body, true)
      const parsed = schema.safeParse(body)
      if (!parsed.success) {
        throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
      }

      return parsed.data
    } catch (error) {
      throwCharacterTransportFailure(error)
    }
  }
}

export function createFameRankingHttp(options: ApiOptions): FameRankingHttp {
  const request = createJsonRequest(options, '/rankings/fame', fameRankingSchema)

  return async (filter) => {
    if (filter.jobGrowId !== undefined && filter.jobId === undefined) {
      throw new SearchHttpFailure('INVALID_SEARCH_QUERY')
    }

    return request({
      ...(filter.jobId !== undefined && { jobId: filter.jobId }),
      ...(filter.jobGrowId !== undefined && { jobGrowId: filter.jobGrowId })
    })
  }
}

export function createCharacterStatsHttp(options: ApiOptions): CharacterStatsHttp {
  const request = createJsonRequest(options, '/stats', characterStatsSchema)

  return () => request()
}
