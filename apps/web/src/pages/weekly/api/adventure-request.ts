import type { z } from 'zod'
import { createJsonRequest, SearchHttpFailure } from '#core/api'
import { API_BASE_URL, dfragonHttp } from '#shared/api/dfragon-api'

const requestJson = createJsonRequest(dfragonHttp, API_BASE_URL)

type JsonRequestOptions = Parameters<typeof requestJson>[2]

export async function requestAdventureJson<Schema extends z.ZodType>(
  adventureName: string,
  path: string,
  schema: Schema,
  options?: JsonRequestOptions
): Promise<z.infer<Schema>> {
  if (adventureName.trim() === '') {
    throw new SearchHttpFailure('INVALID_SEARCH_QUERY')
  }

  return requestJson(`/adventures/${encodeURIComponent(adventureName)}${path}`, schema, options)
}
