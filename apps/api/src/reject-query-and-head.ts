import { type CanActivate, type ExecutionContext, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { CharacterDetailFailure } from './characters/details/errors.js'

class RejectQueryAndHeadGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>()
    // Express는 GET 경로에 HEAD도 보내므로 method로 HEAD를 거른다.
    if (request.method !== 'GET' || request.originalUrl.includes('?')) {
      throw new CharacterDetailFailure('query')
    }

    return true
  }
}

export function RejectQueryAndHead(): ClassDecorator & MethodDecorator {
  return UseGuards(new RejectQueryAndHeadGuard())
}
