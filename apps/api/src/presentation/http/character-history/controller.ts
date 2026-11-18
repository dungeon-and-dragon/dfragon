import type { AccessLogEnv } from '@dfragon/http-server'
import { Hono } from 'hono'
import type { CharacterHistoryService } from '#application/character-history/index.js'
import { respondUnlessDisconnected } from '#presentation/http/disconnected-request.js'
import { readQuery } from '#presentation/http/request-query.js'
import { parseSnapshotAt, readIdentity } from './dto.js'

export class CharacterHistoryController {
  constructor(private readonly service: CharacterHistoryService) {}

  routes(): Hono<AccessLogEnv> {
    const routes = new Hono<AccessLogEnv>()

    routes.get('/:serverId/:characterId/history', async (c) => {
      const history = await this.service.readHistory(readIdentity(c))

      return c.json(history)
    })

    routes.get('/:serverId/:characterId/history/snapshot', (c) => {
      const identity = readIdentity(c)
      const at = parseSnapshotAt(readQuery(c))

      return respondUnlessDisconnected(c, async (signal) => {
        const snapshot = await this.service.readSnapshot(identity, at, signal)

        return c.json(snapshot)
      })
    })

    return routes
  }
}
