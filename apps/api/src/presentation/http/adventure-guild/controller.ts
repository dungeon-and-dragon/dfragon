import { Hono } from 'hono'
import type { AdventureGuildService } from '../../../application/adventure-guild/service.js'
import { CharacterDetailFailure } from '../../../domain/character-failure.js'
import { readQuery } from '../request-query.js'
import {
  type ActivitySeasonResponse,
  type AdventureActivityResponse,
  type AdventureSeasonDaysResponse,
  activityQuery,
  parseSeason,
  toAdventureCharactersResponse,
  toAdventureWeeklyResponse,
  toGuildMembersResponse
} from './dto.js'

export class AdventureGuildController {
  constructor(private readonly service: AdventureGuildService) {}

  routes(): Hono {
    const routes = new Hono()

    routes.get('/adventures/:adventureName/characters', async (c) => {
      const adventureName = c.req.param('adventureName')
      const characters = await this.service.adventure(adventureName)

      return c.json(toAdventureCharactersResponse(adventureName, characters))
    })

    routes.get('/guilds/:guildId', async (c) => {
      const guildId = c.req.param('guildId')
      const guild = await this.service.guild(guildId)

      return c.json(toGuildMembersResponse(guildId, guild))
    })

    routes.get('/adventures/:adventureName/weekly', async (c) => {
      const adventureName = c.req.param('adventureName')
      const weekly = await this.service.adventureWeekly(adventureName)

      return c.json(toAdventureWeeklyResponse(adventureName, weekly))
    })

    routes.get('/adventures/:adventureName/activity', async (c) => {
      const parsed = activityQuery.safeParse(readQuery(c))

      if (!parsed.success) {
        throw new CharacterDetailFailure('query')
      }

      const activity: AdventureActivityResponse = await this.service.adventureActivity(
        c.req.param('adventureName'),
        parsed.data.season
      )

      return c.json(activity)
    })

    routes.get('/adventures/:adventureName/activity/seasons/:season/days', async (c) => {
      const season = parseSeason(c.req.param('season'))
      const days: AdventureSeasonDaysResponse = await this.service.adventureSeasonDays(
        c.req.param('adventureName'),
        season
      )

      return c.json(days)
    })

    routes.post('/adventures/:adventureName/activity/seasons/:season/backfill', async (c) => {
      const season = parseSeason(c.req.param('season'))
      const backfill: ActivitySeasonResponse = await this.service.adventureSeasonBackfill(
        c.req.param('adventureName'),
        season
      )

      return c.json(backfill)
    })

    return routes
  }
}
