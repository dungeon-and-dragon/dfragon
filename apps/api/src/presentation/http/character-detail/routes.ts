import {
  type AccessLogEnv,
  JSON_CONTENT_TYPE,
  recordAccessLogCachedResponse,
  recordAccessLogNeopleStage,
  recordAccessLogSharedNeopleFetch
} from '@dfragon/http-server'
import { type Context, Hono } from 'hono'
import type { NeopleStageTimings } from '../../../application/character-detail/neople-stages.js'
import type {
  CharacterDetailResponse,
  CharacterDetailService
} from '../../../application/character-detail/service.js'
import { parseCharacterIdentity } from '../../../domain/character-identity.js'
import { respondUnlessDisconnected } from '../disconnected-request.js'

type DetailContext = Context<AccessLogEnv, '/:serverId/:characterId'>

function readIdentity(c: DetailContext) {
  return parseCharacterIdentity(c.req.param('serverId'), c.req.param('characterId'))
}

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

export function createCharacterDetailRoutes(service: CharacterDetailService): Hono<AccessLogEnv> {
  const routes = new Hono<AccessLogEnv>()

  routes.get('/:serverId/:characterId', (c) => {
    const identity = readIdentity(c)

    return respondUnlessDisconnected(c, async (signal) =>
      sendDetail(c, await service.get(identity, signal, accessLogTimings(c)))
    )
  })

  routes.post('/:serverId/:characterId/refresh', (c) => {
    const identity = readIdentity(c)

    return respondUnlessDisconnected(c, async (signal) =>
      sendDetail(c, await service.refresh(identity, signal, accessLogTimings(c)))
    )
  })

  return routes
}
