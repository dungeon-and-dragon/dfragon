import type { AccessLogEnv } from '@dfragon/http-server'
import { Hono } from 'hono'
import type { CharacterImageService } from '../../../application/character-image/service.js'
import { respondUnlessDisconnected } from '../disconnected-request.js'
import { readIdentity } from './dto.js'

// API는 초상화를 저장하지 않고 브라우저 캐시만 쓴다. 캐릭터 상세 캐시와 같은 1시간이다.
const IMAGE_CACHE_CONTROL = 'private, max-age=3600'

export class CharacterImageController {
  constructor(private readonly service: CharacterImageService) {}

  routes(): Hono<AccessLogEnv> {
    const routes = new Hono<AccessLogEnv>()

    routes.get('/:serverId/:characterId/image', (c) => {
      const identity = readIdentity(c)

      return respondUnlessDisconnected(c, async (signal) =>
        c.body(await this.service.image(identity, signal), 200, {
          'Content-Type': 'image/png',
          'Cache-Control': IMAGE_CACHE_CONTROL
        })
      )
    })

    return routes
  }
}
