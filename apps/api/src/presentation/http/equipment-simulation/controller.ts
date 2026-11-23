import { type AccessLogEnv, createFailureHandler } from '@dfragon/http-server'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { parseCharacterIdentity } from '@dfragon/server-core/domain/character-identity.js'
import type { EquipmentSimulationService } from '#application/equipment-simulation/index.js'
import { EquipmentSimulationFailure } from '#domain/equipment-simulation/index.js'
import { respondUnlessDisconnected } from '#presentation/http/disconnected-request.js'
import { type EquipmentSimulationResponse, parseSimulationRequest } from './dto.js'
import { equipmentSimulationFailureResponse } from './failures.js'

// 12부위를 모두 바꾼 요청도 항목마다 100바이트 남짓이라, 운영 app과 같은 상한으로 넉넉히 둔다.
const BODY_LIMIT_BYTES = 16 * 1024

const limitBody = bodyLimit({
  maxSize: BODY_LIMIT_BYTES,
  onError: () => {
    throw new EquipmentSimulationFailure('request')
  }
})

export class EquipmentSimulationController {
  constructor(private readonly service: EquipmentSimulationService) {}

  routes(): Hono<AccessLogEnv> {
    const routes = new Hono<AccessLogEnv>()
    routes.onError(createFailureHandler(equipmentSimulationFailureResponse))

    routes.post('/:serverId/:characterId/simulation', limitBody, async (c) => {
      const identity = parseCharacterIdentity(c.req.param('serverId'), c.req.param('characterId'))
      const request = parseSimulationRequest(await c.req.text())

      return respondUnlessDisconnected(c, async (signal) => {
        const scores: EquipmentSimulationResponse = await this.service.simulate(
          identity,
          request,
          signal
        )

        return c.json(scores)
      })
    })

    return routes
  }
}
