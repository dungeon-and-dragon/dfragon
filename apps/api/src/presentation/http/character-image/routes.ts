import type { AccessLogEnv } from '@dfragon/http-server'
import { Hono } from 'hono'
import type { FetchCharacterImage } from '../../../application/character-image/ports.js'
import { parseCharacterIdentity } from '../../../domain/character-identity.js'
import { respondUnlessDisconnected } from '../disconnected-request.js'

// API는 초상화를 저장하지 않고 브라우저 캐시만 쓴다. 캐릭터 상세 캐시와 같은 1시간이다.
const IMAGE_CACHE_CONTROL = 'private, max-age=3600'

export function createCharacterImageRoutes(fetchImage: FetchCharacterImage): Hono<AccessLogEnv> {
  const routes = new Hono<AccessLogEnv>()

  routes.get('/:serverId/:characterId/image', (c) => {
    const identity = parseCharacterIdentity(c.req.param('serverId'), c.req.param('characterId'))

    return respondUnlessDisconnected(c, async (signal) =>
      c.body(await fetchImage(identity, signal), 200, {
        'Content-Type': 'image/png',
        'Cache-Control': IMAGE_CACHE_CONTROL
      })
    )
  })

  return routes
}
