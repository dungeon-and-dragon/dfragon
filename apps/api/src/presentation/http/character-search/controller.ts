import {
  type AccessLogEnv,
  createFailureHandler,
  recordAccessLogCachedResponse,
  recordAccessLogSharedNeopleFetch
} from '@dfragon/http-server'
import { Hono } from 'hono'
import type { CharacterSearchService } from '../../../application/character-search/service.js'
import {
  parseCharacterCandidatesQuery,
  parseCharacterSearchQuery
} from '../../../domain/character-search/query.js'
import { respondUnlessDisconnected } from '../disconnected-request.js'
import type { CharacterCandidatesWithAdventureResponse, CharacterSearchResponse } from './dto.js'
import { characterSearchFailureResponse } from './failures.js'

export class CharacterSearchController {
  constructor(private readonly service: CharacterSearchService) {}

  // 중복 key와 인코딩을 직접 검증하므로 query는 요청 URL의 원문 그대로 파서에 넘긴다.
  routes(): Hono<AccessLogEnv> {
    const routes = new Hono<AccessLogEnv>()
    routes.onError(createFailureHandler(characterSearchFailureResponse))

    routes.get('/', (c) =>
      respondUnlessDisconnected(c, async () => {
        const search: CharacterSearchResponse = await this.service.search(
          parseCharacterSearchQuery(c.req.url)
        )

        return c.json(search)
      })
    )

    routes.get('/candidates', (c) =>
      respondUnlessDisconnected(c, async () => {
        const { result, source } = await this.service.candidates(
          parseCharacterCandidatesQuery(c.req.url)
        )

        if (source === 'cache') {
          recordAccessLogCachedResponse(c)
        } else if (source === 'shared') {
          recordAccessLogSharedNeopleFetch(c)
        }

        const candidates: CharacterCandidatesWithAdventureResponse = result

        return c.json(candidates)
      })
    )

    return routes
  }
}
