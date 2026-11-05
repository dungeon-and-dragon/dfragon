import { Controller, Get, Inject, Param } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiAdventureCharacters, ApiAdventureWeekly, ApiGuild } from '../swagger/operations.js'
import type {
  AdventureCharacters,
  AdventureGuildService,
  AdventureWeekly,
  GuildMembers
} from './service.js'

export const ADVENTURE_GUILD_SERVICE = Symbol('ADVENTURE_GUILD_SERVICE')

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
}
