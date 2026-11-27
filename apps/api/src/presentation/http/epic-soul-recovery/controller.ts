import { type AccessLogEnv, createFailureHandler } from '@dfragon/http-server'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { z } from 'zod'
import { parseCharacterIdentity } from '@dfragon/server-core/domain/character-identity.js'
import type {
  EpicSoulRecoveryResult,
  EpicSoulRecoveryService
} from '#application/epic-soul-recovery/index.js'
import { EquipmentSimulationFailure } from '#domain/equipment-simulation/index.js'
import { respondUnlessDisconnected } from '#presentation/http/disconnected-request.js'
import { equipmentSimulationFailureResponse } from '#presentation/http/equipment-simulation/failures.js'

const BODY_LIMIT_BYTES = 1024

const limitBody = bodyLimit({
  maxSize: BODY_LIMIT_BYTES,
  onError: () => {
    throw new EquipmentSimulationFailure('request')
  }
})

const recoveryRequest = z.strictObject({ includePrimordial: z.boolean() })

function parseRecoveryRequest(text: string): boolean {
  let body: unknown

  try {
    body = JSON.parse(text)
  } catch {
    throw new EquipmentSimulationFailure('request')
  }

  const parsed = recoveryRequest.safeParse(body)

  if (!parsed.success) {
    throw new EquipmentSimulationFailure('request')
  }

  return parsed.data.includePrimordial
}

export class EpicSoulRecoveryController {
  constructor(private readonly service: EpicSoulRecoveryService) {}

  routes(): Hono<AccessLogEnv> {
    const routes = new Hono<AccessLogEnv>()
    routes.onError(createFailureHandler(equipmentSimulationFailureResponse))

    routes.post('/:serverId/:characterId/epic-soul-recovery', limitBody, async (c) => {
      const identity = parseCharacterIdentity(c.req.param('serverId'), c.req.param('characterId'))
      const includePrimordial = parseRecoveryRequest(await c.req.text())

      return respondUnlessDisconnected(c, async (signal) => {
        const recovery: EpicSoulRecoveryResult = await this.service.recover(
          identity,
          includePrimordial,
          signal
        )

        return c.json(recovery)
      })
    })

    return routes
  }
}
