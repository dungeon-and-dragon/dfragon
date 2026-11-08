import { Controller, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { CharacterDetailFailure } from '../characters/details/errors.js'
import {
  ApiAdventureActivity,
  ApiAdventureActivityDay,
  ApiAdventureSeasonDays,
  ApiAdventureCharacters,
  ApiAdventureSeasonBackfill,
  ApiAdventureWeekly,
  ApiGuild
} from '../swagger/operations.js'
import {
  type ActivityDayDetail,
  type ActivitySeason,
  type AdventureActivity,
  type AdventureSeasonDays,
  toActivityDayRange
} from './activity.js'
import type {
  AdventureCharacters,
  AdventureGuildService,
  AdventureWeekly,
  GuildMembers
} from './service.js'

export const ADVENTURE_GUILD_SERVICE = Symbol('ADVENTURE_GUILD_SERVICE')

const SEASON_NUMBER_PATTERN = /^[1-9]\d{0,3}$/
const seasonNumber = z.string().regex(SEASON_NUMBER_PATTERN).transform(Number)
const activityQuery = z.object({ season: seasonNumber.optional() })

@ApiTags('캐릭터')
@Controller()
export class AdventureGuildController {
  constructor(@Inject(ADVENTURE_GUILD_SERVICE) private readonly service: AdventureGuildService) {}

  @Get('adventures/:adventureName/characters')
  @ApiAdventureCharacters()
  adventure(@Param('adventureName') adventureName: string): Promise<AdventureCharacters> {
    return this.service.adventure(adventureName)
  }

  @Get('guilds/:guildId')
  @ApiGuild()
  guild(@Param('guildId') guildId: string): Promise<GuildMembers> {
    return this.service.guild(guildId)
  }

  @Get('adventures/:adventureName/weekly')
  @ApiAdventureWeekly()
  adventureWeekly(@Param('adventureName') adventureName: string): Promise<AdventureWeekly> {
    return this.service.adventureWeekly(adventureName)
  }

  @Get('adventures/:adventureName/activity')
  @ApiAdventureActivity()
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

  @Get('adventures/:adventureName/activity/days/:date')
  @ApiAdventureActivityDay()
  adventureActivityDay(
    @Param('adventureName') adventureName: string,
    @Param('date') date: string
  ): Promise<ActivityDayDetail> {
    const day = toActivityDayRange(date)
    if (day === undefined) {
      throw new CharacterDetailFailure('query')
    }

    return this.service.adventureActivityDay(adventureName, day)
  }

  @Get('adventures/:adventureName/activity/seasons/:season/days')
  @ApiAdventureSeasonDays()
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
  @ApiAdventureSeasonBackfill()
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
