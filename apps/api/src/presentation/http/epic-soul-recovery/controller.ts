import { type AccessLogEnv, createFailureHandler } from '@dfragon/http-server'
import { Hono } from 'hono'
import { parseCharacterIdentity } from '@dfragon/server-core/domain/character-identity.js'
import type {
  EpicSoulRecoveryService,
  WornEpicSouls
} from '#application/epic-soul-recovery/index.js'
import { characterFailureResponse } from '#presentation/http/character-failures.js'
import { respondUnlessDisconnected } from '#presentation/http/disconnected-request.js'

export class EpicSoulRecoveryController {
  constructor(private readonly service: EpicSoulRecoveryService) {}

  routes(): Hono<AccessLogEnv> {
    const routes = new Hono<AccessLogEnv>()
    routes.onError(createFailureHandler(characterFailureResponse))

    routes.get('/:serverId/:characterId/epic-soul-recovery', async (c) => {
      const identity = parseCharacterIdentity(c.req.param('serverId'), c.req.param('characterId'))

      return respondUnlessDisconnected(c, async (signal) => {
        const souls: WornEpicSouls = await this.service.recover(identity, signal)

        return c.json(souls)
      })
    })

    return routes
  }
}
