import {
  type AccessLogEnv,
  JSON_CONTENT_TYPE,
  recordAccessLogCachedResponse,
  recordAccessLogNeopleStage,
  recordAccessLogSharedNeopleFetch
} from '@dfragon/http-server'
import { Hono } from 'hono'
import type { NeopleStageTimings } from '../../../application/character-detail/neople-stages.js'
import type {
  CharacterDetailResponse,
  CharacterDetailService
} from '../../../application/character-detail/service.js'
import { respondUnlessDisconnected } from '../disconnected-request.js'
import { type DetailContext, readIdentity } from './dto.js'

function accessLogTimings(c: DetailContext): NeopleStageTimings {
  return {
    record: (stage, durationMs) => recordAccessLogNeopleStage(c, stage, durationMs),
    markShared: () => recordAccessLogSharedNeopleFetch(c)
  }
}

// 저장한 본문을 다시 직렬화하지 않고 보낸다. 압축은 Caddy가 맡으므로 인코딩하지 않는다.
function sendDetail(c: DetailContext, { body, reused }: CharacterDetailResponse): Response {
  if (reused) {
    recordAccessLogCachedResponse(c)
  }

  return c.body(body, 200, { 'Content-Type': JSON_CONTENT_TYPE })
}

export class CharacterDetailController {
  constructor(private readonly service: CharacterDetailService) {}

  routes(): Hono<AccessLogEnv> {
    const routes = new Hono<AccessLogEnv>()

    routes.get('/:serverId/:characterId', (c) => {
      const identity = readIdentity(c)

      return respondUnlessDisconnected(c, async (signal) => {
        const timings = accessLogTimings(c)
        const detail = await this.service.get(identity, signal, timings)

        return sendDetail(c, detail)
      })
    })

    routes.post('/:serverId/:characterId/refresh', (c) => {
      const identity = readIdentity(c)

      return respondUnlessDisconnected(c, async (signal) => {
        const timings = accessLogTimings(c)
        const detail = await this.service.refresh(identity, signal, timings)

        return sendDetail(c, detail)
      })
    })

    return routes
  }
}
