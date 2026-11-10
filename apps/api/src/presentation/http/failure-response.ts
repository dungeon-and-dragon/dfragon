import { Catch } from '@nestjs/common'
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common'
import type { Response } from 'express'
import { recordAccessLogErrorChain, recordAccessLogErrorCode } from '../../access-log.js'

export interface FailureResponse {
  readonly status: number
  readonly body: { readonly error: { readonly code: string; readonly message: string } }
}

export function sendFailureResponse(
  response: Response,
  error: unknown,
  failure: FailureResponse
): void {
  recordAccessLogErrorCode(response, failure.body.error.code)
  recordAccessLogErrorChain(response, error)
  response.status(failure.status).json(failure.body)
}

@Catch()
export class FailureResponseFilter implements ExceptionFilter {
  constructor(private readonly toFailureResponse: (error: unknown) => FailureResponse) {}

  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>()
    if (response.headersSent) {
      response.end()

      return
    }
    sendFailureResponse(response, error, this.toFailureResponse(error))
  }
}
