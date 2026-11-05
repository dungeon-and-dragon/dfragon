import { Controller, Get, Inject, Param, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { Request } from 'express'
import { CharacterDetailFailure } from '../characters/details/errors.js'
import { ApiAdventureCharacters, ApiGuild } from '../swagger/operations.js'
import type { AdventureCharacters, AdventureGuildService, GuildMembers } from './service.js'

export const ADVENTURE_GUILD_SERVICE = Symbol('ADVENTURE_GUILD_SERVICE')

function rejectQueryAndHead(request: Request): void {
  if (request.method !== 'GET' || request.originalUrl.includes('?')) {
    throw new CharacterDetailFailure('query')
  }
}

@ApiTags('캐릭터')
@Controller()
export class AdventureGuildController {
  constructor(@Inject(ADVENTURE_GUILD_SERVICE) private readonly service: AdventureGuildService) {}

  @Get('adventures/:adventureName/characters')
  @ApiAdventureCharacters()
  adventure(
    @Req() request: Request,
    @Param('adventureName') adventureName: string
  ): Promise<AdventureCharacters> {
    rejectQueryAndHead(request)

    return this.service.adventure(adventureName)
  }

  @Get('guilds/:guildId')
  @ApiGuild()
  guild(@Req() request: Request, @Param('guildId') guildId: string): Promise<GuildMembers> {
    rejectQueryAndHead(request)

    return this.service.guild(guildId)
  }
}
