import { Controller, Get, Inject, Req, Res, UseFilters } from '@nestjs/common'
import type { Request, Response } from 'express'
import type { FetchCharacterImage } from '../../../application/character-image/ports.js'
import { parseCharacterIdentity } from '../../../domain/character-identity.js'
import { sendWithCancellation } from '../http-response.js'
import { characterFailureResponse } from '../character-failures.js'
import { FailureResponseFilter } from '../failure-response.js'

export const CHARACTER_IMAGE_FETCH = Symbol('CHARACTER_IMAGE_FETCH')
// API는 초상화를 저장하지 않고 브라우저 캐시만 쓴다. 캐릭터 상세 캐시와 같은 1시간이다.
const IMAGE_CACHE_CONTROL = 'private, max-age=3600'

@Controller('characters')
@UseFilters(new FailureResponseFilter(characterFailureResponse))
export class CharacterImageController {
  constructor(@Inject(CHARACTER_IMAGE_FETCH) private readonly fetchImage: FetchCharacterImage) {}

  @Get(':serverId/:characterId/image')
  async image(@Req() request: Request, @Res() response: Response): Promise<void> {
    const identity = parseCharacterIdentity(request.params.serverId, request.params.characterId)
    await sendWithCancellation(
      response,
      (signal) => this.fetchImage(identity, signal),
      (image) => {
        response.setHeader('Content-Type', 'image/png')
        response.setHeader('Cache-Control', IMAGE_CACHE_CONTROL)
        response.status(200).send(image)
      }
    )
  }
}
