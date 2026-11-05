import { Controller, Get, Inject, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { Request } from 'express'
import { CharacterDetailFailure } from '../characters/details/errors.js'
import { ApiAdventureCharacters, ApiGuild } from '../swagger/operations.js'
import type { AdventureCharacters, AdventureGuildService, GuildMembers } from './service.js'

export const ADVENTURE_GUILD_SERVICE = Symbol('ADVENTURE_GUILD_SERVICE')

function pathValue(request: Request, name: string): string {
  const value = request.params[name]
  if (request.method !== 'GET' || request.originalUrl.includes('?') || typeof value !== 'string') {
    throw new CharacterDetailFailure('query')
  }

  return value
}

@ApiTags('캐릭터')
@Controller()
export class AdventureGuildController {
  constructor(@Inject(ADVENTURE_GUILD_SERVICE) private readonly service: AdventureGuildService) {}

  @Get('adventures/:adventureName/characters')
  @ApiAdventureCharacters()
  adventure(@Req() request: Request): Promise<AdventureCharacters> {
    return this.service.adventure(pathValue(request, 'adventureName'))
  }

  @Get('guilds/:guildId')
  @ApiGuild()
  guild(@Req() request: Request): Promise<GuildMembers> {
    return this.service.guild(pathValue(request, 'guildId'))
  }
}
