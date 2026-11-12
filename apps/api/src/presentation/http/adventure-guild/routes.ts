import { Hono } from 'hono'
import { z } from 'zod'
import type { AdventureGuildService } from '../../../application/adventure-guild/service.js'
import { CharacterDetailFailure } from '../../../domain/character-failure.js'
import { readQuery } from '../request-query.js'

const SEASON_NUMBER_PATTERN = /^[1-9]\d{0,3}$/
const seasonNumber = z.string().regex(SEASON_NUMBER_PATTERN).transform(Number)
const activityQuery = z.object({ season: seasonNumber.optional() })

function parseSeason(season: string): number {
  const parsed = seasonNumber.safeParse(season)
  if (!parsed.success) {
    throw new CharacterDetailFailure('query')
  }

  return parsed.data
}

export function createAdventureGuildRoutes(service: AdventureGuildService): Hono {
  const routes = new Hono()

  routes.get('/adventures/:adventureName/characters', async (c) =>
    c.json(await service.adventure(c.req.param('adventureName')))
  )

  routes.get('/guilds/:guildId', async (c) => c.json(await service.guild(c.req.param('guildId'))))

  routes.get('/adventures/:adventureName/weekly', async (c) =>
    c.json(await service.adventureWeekly(c.req.param('adventureName')))
  )

  routes.get('/adventures/:adventureName/activity', async (c) => {
    const parsed = activityQuery.safeParse(readQuery(c))
    if (!parsed.success) {
      throw new CharacterDetailFailure('query')
    }

    return c.json(await service.adventureActivity(c.req.param('adventureName'), parsed.data.season))
  })

  routes.get('/adventures/:adventureName/activity/seasons/:season/days', async (c) => {
    const season = parseSeason(c.req.param('season'))

    return c.json(await service.adventureSeasonDays(c.req.param('adventureName'), season))
  })

  routes.post('/adventures/:adventureName/activity/seasons/:season/backfill', async (c) => {
    const season = parseSeason(c.req.param('season'))

    return c.json(await service.adventureSeasonBackfill(c.req.param('adventureName'), season))
  })

  return routes
}
