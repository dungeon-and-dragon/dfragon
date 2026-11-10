import { Catch, NotFoundException } from '@nestjs/common'
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common'
import type { Request, Response } from 'express'
import { recordAccessLogErrorChain, recordAccessLogErrorCode } from './access-log.js'

export interface FailureResponse {
  readonly status: number
  readonly body: { readonly error: { readonly code: string; readonly message?: string } }
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
    const context = host.switchToHttp()
    const response = context.getResponse<Response>()
    if (response.headersSent) {
      response.end()

      return
    }

    if (context.getRequest<Request>().route == null && error instanceof NotFoundException) {
      response.status(404).json({ statusCode: 404, message: 'Not Found' })

      return
    }
    sendFailureResponse(response, error, this.toFailureResponse(error))
  }
}
