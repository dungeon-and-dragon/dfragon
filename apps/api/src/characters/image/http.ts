import { Controller, Get, Inject, Req, Res } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { sendWithCancellation } from '../../http-response.js'
import { ApiCharacterImage } from '../../swagger/operations.js'
import { CharacterDetailFailure } from '../details/errors.js'
import { parseCharacterIdentity } from '../identity.js'
import type { FetchCharacterImage } from './neople.js'

export const CHARACTER_IMAGE_FETCH = Symbol('CHARACTER_IMAGE_FETCH')
// API는 초상화를 저장하지 않고 브라우저 캐시만 쓴다. 캐릭터 상세 캐시와 같은 1시간이다.
const IMAGE_CACHE_CONTROL = 'private, max-age=3600'

@ApiTags('캐릭터')
@Controller('characters')
export class CharacterImageController {
  constructor(@Inject(CHARACTER_IMAGE_FETCH) private readonly fetchImage: FetchCharacterImage) {}

  @Get(':serverId/:characterId/image')
  @ApiCharacterImage()
  async image(@Req() request: Request, @Res() response: Response): Promise<void> {
    if (request.method !== 'GET') {
      throw new CharacterDetailFailure('query')
    }
    const identity = parseCharacterIdentity(
      request.params.serverId,
      request.params.characterId,
      request.originalUrl
    )
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
