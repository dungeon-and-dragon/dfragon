import { Controller, Get, Inject, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { Request } from 'express'
import { ApiCharacterTimeline } from '../../swagger/operations.js'
import { CharacterDetailFailure } from '../details/errors.js'
import { parseCharacterIdentity } from '../identity.js'
import type { CharacterTimeline } from './read.js'
import type { CharacterTimelineService } from './service.js'

export const CHARACTER_TIMELINE_SERVICE = Symbol('CHARACTER_TIMELINE_SERVICE')

@ApiTags('캐릭터')
@Controller('characters')
export class CharacterTimelineController {
  constructor(
    @Inject(CHARACTER_TIMELINE_SERVICE) private readonly service: CharacterTimelineService
  ) {}

  @Get(':serverId/:characterId/timeline')
  @ApiCharacterTimeline()
  timeline(@Req() request: Request): Promise<CharacterTimeline> {
    if (request.method !== 'GET') {
      throw new CharacterDetailFailure('query')
    }
    const identity = parseCharacterIdentity(
      request.params.serverId,
      request.params.characterId,
      request.originalUrl
    )

    return this.service.get(identity)
  }
}
