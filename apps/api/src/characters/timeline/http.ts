import { Controller, Get, Inject, Query, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { Request } from 'express'
import { z } from 'zod'
import { CharacterDetailFailure } from '../details/errors.js'
import {
  ApiCharacterTimeline,
  ApiCharacterTimelineAcquisitions,
  ApiCharacterTimelineEnhancements
} from '../../swagger/operations.js'
import { parseCharacterIdentity } from '../identity.js'
import {
  type CharacterTimeline,
  parseTimelineCursor,
  type TimelineItemPage,
  type TimelinePageList
} from './read.js'
import type { CharacterTimelineService } from './service.js'

export const CHARACTER_TIMELINE_SERVICE = Symbol('CHARACTER_TIMELINE_SERVICE')

const pageQuery = z.object({ before: z.string() }).strict()

@ApiTags('캐릭터')
@Controller('characters')
export class CharacterTimelineController {
  constructor(
    @Inject(CHARACTER_TIMELINE_SERVICE) private readonly service: CharacterTimelineService
  ) {}

  @Get(':serverId/:characterId/timeline')
  @ApiCharacterTimeline()
  timeline(@Req() request: Request): Promise<CharacterTimeline> {
    const identity = parseCharacterIdentity(request.params.serverId, request.params.characterId)

    return this.service.get(identity)
  }

  @Get(':serverId/:characterId/timeline/enhancements')
  @ApiCharacterTimelineEnhancements()
  enhancements(@Req() request: Request, @Query() query: unknown): Promise<TimelineItemPage> {
    return this.page(request, query, 'enhancements')
  }

  @Get(':serverId/:characterId/timeline/acquisitions')
  @ApiCharacterTimelineAcquisitions()
  acquisitions(@Req() request: Request, @Query() query: unknown): Promise<TimelineItemPage> {
    return this.page(request, query, 'acquisitions')
  }

  private page(
    request: Request,
    query: unknown,
    list: TimelinePageList
  ): Promise<TimelineItemPage> {
    const identity = parseCharacterIdentity(request.params.serverId, request.params.characterId)
    const parsed = pageQuery.safeParse(query)
    const before = parsed.success ? parseTimelineCursor(parsed.data.before) : undefined
    if (before === undefined) {
      throw new CharacterDetailFailure('query')
    }

    return this.service.page(identity, list, before)
  }
}
