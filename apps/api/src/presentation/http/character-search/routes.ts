import { Hono } from 'hono'
import type { CharacterSearchHttpService } from '../../../application/character-search/service.js'
import {
  parseCharacterCandidatesQuery,
  parseCharacterSearchQuery
} from '../../../domain/character-search/query.js'
import {
  type AccessLogEnv,
  recordAccessLogCachedResponse,
  recordAccessLogSharedNeopleFetch
} from '../access-log.js'
import { respondUnlessDisconnected } from '../disconnected-request.js'
import { createFailureHandler } from '../failure-response.js'
import { characterSearchFailureResponse } from './failures.js'

// 중복 key와 인코딩을 직접 검증하므로 query는 요청 URL의 원문 그대로 파서에 넘긴다.
export function createCharacterSearchRoutes(
  service: CharacterSearchHttpService
): Hono<AccessLogEnv> {
  const routes = new Hono<AccessLogEnv>()
  routes.onError(createFailureHandler(characterSearchFailureResponse))

  routes.get('/', (c) =>
    respondUnlessDisconnected(c, async () =>
      c.json(await service.search(parseCharacterSearchQuery(c.req.url)))
    )
  )

  routes.get('/candidates', (c) =>
    respondUnlessDisconnected(c, async () => {
      const { result, source } = await service.candidates(parseCharacterCandidatesQuery(c.req.url))
      if (source === 'cache') {
        recordAccessLogCachedResponse(c)
      } else if (source === 'shared') {
        recordAccessLogSharedNeopleFetch(c)
      }

      return c.json(result)
    })
  )

  return routes
}
