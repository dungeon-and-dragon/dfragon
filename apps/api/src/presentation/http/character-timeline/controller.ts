import { Hono } from 'hono'
import type { CharacterTimelineService } from '../../../application/character-timeline/service.js'
import type { TimelinePageList } from '../../../domain/character-timeline/project.js'
import { readQuery } from '../request-query.js'
import {
  type CharacterContext,
  type CharacterTimelineResponse,
  type TimelineItemPageResponse,
  parsePageCursor,
  readIdentity
} from './dto.js'

export class CharacterTimelineController {
  constructor(private readonly service: CharacterTimelineService) {}

  routes(): Hono {
    const routes = new Hono()

    routes.get('/:serverId/:characterId/timeline', async (c) => {
      const timeline: CharacterTimelineResponse = await this.service.get(readIdentity(c))

      return c.json(timeline)
    })

    const respondWithPage = async (c: CharacterContext, list: TimelinePageList) => {
      const identity = readIdentity(c)
      const before = parsePageCursor(readQuery(c))
      const page: TimelineItemPageResponse = await this.service.page(identity, list, before)

      return c.json(page)
    }

    routes.get('/:serverId/:characterId/timeline/enhancements', (c) =>
      respondWithPage(c, 'enhancements')
    )

    routes.get('/:serverId/:characterId/timeline/acquisitions', (c) =>
      respondWithPage(c, 'acquisitions')
    )

    return routes
  }
}
