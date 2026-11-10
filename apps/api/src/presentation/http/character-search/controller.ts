import { ApiTags } from '@nestjs/swagger'
import { Controller, Get, Inject, Req, Res, UseFilters } from '@nestjs/common'
import type { Request, Response } from 'express'
import {
  recordAccessLogCachedResponse,
  recordAccessLogSharedNeopleFetch
} from '../../../access-log.js'
import type {
  CharacterCandidatesResponse,
  CharacterSearchHttpService
} from '../../../application/character-search/service.js'
import {
  parseCharacterCandidatesQuery,
  parseCharacterSearchQuery
} from '../../../domain/character-search/query.js'
import { respondWithCancellation, sendWithCancellation } from '../../../http-response.js'
import { ApiCharacterCandidates, ApiCharacterSearch } from '../../openapi/character-search.js'
import { FailureResponseFilter } from '../failure-response.js'
import { characterSearchFailureResponse } from './failures.js'

export const CHARACTER_SEARCH_SERVICE = Symbol('CHARACTER_SEARCH_SERVICE')

@ApiTags('캐릭터')
@Controller('characters')
@UseFilters(new FailureResponseFilter(characterSearchFailureResponse))
export class CharacterSearchController {
  constructor(
    @Inject(CHARACTER_SEARCH_SERVICE) private readonly service: CharacterSearchHttpService
  ) {}

  @Get()
  @ApiCharacterSearch()
  async search(@Req() request: Request, @Res() response: Response): Promise<void> {
    await respondWithCancellation(response, () =>
      this.service.search(parseCharacterSearchQuery(request.originalUrl))
    )
  }

  @Get('candidates')
  @ApiCharacterCandidates()
  async candidates(@Req() request: Request, @Res() response: Response): Promise<void> {
    await sendWithCancellation(
      response,
      () => this.service.candidates(parseCharacterCandidatesQuery(request.originalUrl)),
      (candidates) => sendCandidates(response, candidates)
    )
  }
}

function sendCandidates(response: Response, { result, source }: CharacterCandidatesResponse) {
  if (source === 'cache') {
    recordAccessLogCachedResponse(response)
  } else if (source === 'shared') {
    recordAccessLogSharedNeopleFetch(response)
  }
  response.status(200).json(result)
}
