import { Controller, Get, HttpCode, Inject, Param, Post, Query, UseFilters } from '@nestjs/common'
import { z } from 'zod'
import { CharacterDetailFailure } from '../../../domain/character-failure.js'
import { characterFailureResponse } from '../character-failures.js'
import { FailureResponseFilter } from '../failure-response.js'
import type {
  ActivitySeason,
  AdventureActivity,
  AdventureSeasonDays
} from '../../../domain/adventure-guild/activity.js'
import type {
  AdventureCharacters,
  AdventureWeekly,
  GuildMembers
} from '../../../domain/adventure-guild/responses.js'
import type { AdventureGuildService } from '../../../application/adventure-guild/service.js'

export const ADVENTURE_GUILD_SERVICE = Symbol('ADVENTURE_GUILD_SERVICE')

const SEASON_NUMBER_PATTERN = /^[1-9]\d{0,3}$/
const seasonNumber = z.string().regex(SEASON_NUMBER_PATTERN).transform(Number)
const activityQuery = z.object({ season: seasonNumber.optional() })

@Controller()
@UseFilters(new FailureResponseFilter(characterFailureResponse))
export class AdventureGuildController {
  constructor(@Inject(ADVENTURE_GUILD_SERVICE) private readonly service: AdventureGuildService) {}

  @Get('adventures/:adventureName/characters')
  adventure(@Param('adventureName') adventureName: string): Promise<AdventureCharacters> {
    return this.service.adventure(adventureName)
  }

  @Get('guilds/:guildId')
  guild(@Param('guildId') guildId: string): Promise<GuildMembers> {
    return this.service.guild(guildId)
  }

  @Get('adventures/:adventureName/weekly')
  adventureWeekly(@Param('adventureName') adventureName: string): Promise<AdventureWeekly> {
    return this.service.adventureWeekly(adventureName)
  }

  @Get('adventures/:adventureName/activity')
  adventureActivity(
    @Param('adventureName') adventureName: string,
    @Query() query: unknown
  ): Promise<AdventureActivity> {
    const parsed = activityQuery.safeParse(query)
    if (!parsed.success) {
      throw new CharacterDetailFailure('query')
    }

    return this.service.adventureActivity(adventureName, parsed.data.season)
  }

  @Get('adventures/:adventureName/activity/seasons/:season/days')
  adventureSeasonDays(
    @Param('adventureName') adventureName: string,
    @Param('season') season: string
  ): Promise<AdventureSeasonDays> {
    const parsed = seasonNumber.safeParse(season)
    if (!parsed.success) {
      throw new CharacterDetailFailure('query')
    }

    return this.service.adventureSeasonDays(adventureName, parsed.data)
  }

  @Post('adventures/:adventureName/activity/seasons/:season/backfill')
  @HttpCode(200)
  adventureSeasonBackfill(
    @Param('adventureName') adventureName: string,
    @Param('season') season: string
  ): Promise<ActivitySeason> {
    const parsed = seasonNumber.safeParse(season)
    if (!parsed.success) {
      throw new CharacterDetailFailure('query')
    }

    return this.service.adventureSeasonBackfill(adventureName, parsed.data)
  }
}
