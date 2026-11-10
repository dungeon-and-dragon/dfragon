import { ApiTags } from '@nestjs/swagger'
import {
  ApiCharacterCandidates,
  ApiCharacterSearch
} from '../presentation/openapi/character-search.js'
import { Controller, Get, Inject, Req, Res, UseFilters } from '@nestjs/common'
import type { Request, Response } from 'express'
import { recordAccessLogCachedResponse, recordAccessLogSharedNeopleFetch } from '../access-log.js'
import { respondWithCancellation, sendWithCancellation } from '../http-response.js'
import { characterSearchFailureResponse } from '../presentation/http/character-search/failures.js'
import { FailureResponseFilter } from '../presentation/http/failure-response.js'
import type { CharacterCandidatesResponse, CharacterSearchHttpService } from './types.js'

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
    await respondWithCancellation(response, () => this.service.search(request.originalUrl))
  }

  @Get('candidates')
  @ApiCharacterCandidates()
  async candidates(@Req() request: Request, @Res() response: Response): Promise<void> {
    await sendWithCancellation(
      response,
      () => this.service.candidates(request.originalUrl),
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
