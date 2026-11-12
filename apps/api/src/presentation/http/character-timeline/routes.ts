import { type Context, Hono } from 'hono'
import { z } from 'zod'
import type { CharacterTimelineService } from '../../../application/character-timeline/service.js'
import { CharacterDetailFailure } from '../../../domain/character-failure.js'
import { parseCharacterIdentity } from '../../../domain/character-identity.js'
import {
  type TimelinePageList,
  parseTimelineCursor
} from '../../../domain/character-timeline/project.js'
import { readQuery } from '../request-query.js'

const pageQuery = z.object({ before: z.string() }).strict()

type CharacterContext = Context<object, '/:serverId/:characterId/*'>

function readIdentity(c: CharacterContext) {
  return parseCharacterIdentity(c.req.param('serverId'), c.req.param('characterId'))
}

export function createCharacterTimelineRoutes(service: CharacterTimelineService): Hono {
  const routes = new Hono()

  routes.get('/:serverId/:characterId/timeline', async (c) =>
    c.json(await service.get(readIdentity(c)))
  )

  const respondWithPage = async (c: CharacterContext, list: TimelinePageList) => {
    const identity = readIdentity(c)
    const parsed = pageQuery.safeParse(readQuery(c))
    const before = parsed.success ? parseTimelineCursor(parsed.data.before) : undefined
    if (before === undefined) {
      throw new CharacterDetailFailure('query')
    }

    return c.json(await service.page(identity, list, before))
  }

  routes.get('/:serverId/:characterId/timeline/enhancements', (c) =>
    respondWithPage(c, 'enhancements')
  )

  routes.get('/:serverId/:characterId/timeline/acquisitions', (c) =>
    respondWithPage(c, 'acquisitions')
  )

  return routes
}
