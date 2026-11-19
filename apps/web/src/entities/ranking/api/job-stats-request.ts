import type { z } from 'zod'
import { SearchHttpFailure } from '#shared/api/api-error'
import { createJsonRequest } from '#shared/api/json-request'
import type { SetStatsFilter } from '#entities/ranking/model/ranking-stats'
import { API_BASE_URL, dfragonHttp } from '#shared/api/dfragon-api'

const requestJson = createJsonRequest(dfragonHttp, API_BASE_URL)

function jobSearchParams(filter: SetStatsFilter): Record<string, string> {
  if (filter.jobGrowId !== undefined && filter.jobId === undefined) {
    throw new SearchHttpFailure('INVALID_SEARCH_QUERY')
  }

  return {
    ...(filter.jobId !== undefined && { jobId: filter.jobId }),
    ...(filter.jobGrowId !== undefined && { jobGrowId: filter.jobGrowId }),
    ...(filter.role !== undefined && { role: filter.role })
  }
}

export async function requestJobStats<Schema extends z.ZodType>(
  path: string,
  schema: Schema,
  filter: SetStatsFilter
): Promise<z.infer<Schema>> {
  const searchParams = jobSearchParams(filter)

  return requestJson(path, schema, { searchParams })
}
