import { Controller, Get, Inject, Param, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { CharacterDetailFailure } from '../characters/details/errors.js'
import {
  ApiAdventureActivity,
  ApiAdventureCharacters,
  ApiAdventureWeekly,
  ApiGuild
} from '../swagger/operations.js'
import type { AdventureActivity } from './activity.js'
import type {
  AdventureCharacters,
  AdventureGuildService,
  AdventureWeekly,
  GuildMembers
} from './service.js'

export const ADVENTURE_GUILD_SERVICE = Symbol('ADVENTURE_GUILD_SERVICE')

const SEASON_NUMBER_PATTERN = /^[1-9]\d{0,3}$/
const activityQuery = z.object({
  season: z.string().regex(SEASON_NUMBER_PATTERN).transform(Number).optional()
})

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
}
