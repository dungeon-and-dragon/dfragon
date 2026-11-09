import 'reflect-metadata'
import {
  Catch,
  HttpException,
  Module,
  NotFoundException,
  type ArgumentsHost,
  type ExceptionFilter,
  type INestApplication,
  type OnApplicationShutdown
} from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import type { NextFunction, Request, Response } from 'express'
import {
  type AccessLogSink,
  createAccessLog,
  recordAccessLogErrorChain,
  recordAccessLogErrorCode,
  writeAccessLogToStdout
} from '../access-log.js'
import { OpsFailure } from './errors.js'
import { OPS_JOB_STORE, OpsJobsController, type OpsJobStore } from './jobs.js'

const ACCESS_LOG_SERVICE = 'api-ops'
const BODY_LIMIT = '16kb'
const SAFE_METHODS = new Set(['GET', 'HEAD'])

function isClientError(error: unknown): boolean {
  if (error instanceof HttpException) {
    return error.getStatus() < 500
  }

  // body-parser는 본문 크기, 인코딩 거절을 HttpException이 아닌 http-errors 오류로 넘긴다.
  if (typeof error !== 'object' || error === null || !('status' in error)) {
    return false
  }
  const { status } = error

  return typeof status === 'number' && status >= 400 && status < 500
}

function opsFailure(error: unknown): OpsFailure {
  if (error instanceof OpsFailure) {
    return error
  }

  const kind = isClientError(error) ? 'request' : 'internal'

  return new OpsFailure(kind)
}

function sendFailure(response: Response, failure: OpsFailure): void {
  recordAccessLogErrorCode(response, failure.body.error.code)
  response.status(failure.status).json(failure.body)
}

@Catch()
class OpsHttpFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp()
    const request = context.getRequest<Request>()
    const response = context.getResponse<Response>()
    if (response.headersSent) {
      response.end()

      return
    }

    if (request.route == null && error instanceof NotFoundException) {
      response.status(404).json({ statusCode: 404, message: 'Not Found' })

      return
    }

    recordAccessLogErrorChain(response, error)
    sendFailure(response, opsFailure(error))
  }
}

// 로그인이 없는 운영 포트라, 소유자 브라우저에서 다른 사이트가 form으로 보내는 요청을 preflight가 필요한 JSON으로만 받아 막는다.
function requireJsonContentType(request: Request, response: Response, next: NextFunction): void {
  const mediaType = request.headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase()
  if (SAFE_METHODS.has(request.method) || mediaType === 'application/json') {
    next()

    return
  }
  sendFailure(response, new OpsFailure('mediaType'))
}

class OpsDatabaseConnection implements OnApplicationShutdown {
  constructor(private readonly close: () => Promise<void>) {}

  onApplicationShutdown(): Promise<void> {
    return this.close()
  }
}

export type OpsHttpAppOptions = {
  readonly jobs: OpsJobStore
  readonly close?: () => Promise<void>
  readonly writeAccessLog?: AccessLogSink
}

/** 운영 경로는 이 app에만 등록하고 공개 app과 OpenAPI 문서에는 넣지 않는다. */
export async function createOpsHttpApp({
  jobs,
  close = async () => undefined,
  writeAccessLog = writeAccessLogToStdout
}: OpsHttpAppOptions): Promise<INestApplication> {
  @Module({
    controllers: [OpsJobsController],
    providers: [
      { provide: OPS_JOB_STORE, useValue: jobs },
      { provide: OpsDatabaseConnection, useFactory: () => new OpsDatabaseConnection(close) }
    ]
  })
  class OpsHttpModule {}
  const app = await NestFactory.create<NestExpressApplication>(OpsHttpModule, {
    logger: false,
    bodyParser: false,
    abortOnError: false
  })
  try {
    app.use(createAccessLog(writeAccessLog, ACCESS_LOG_SERVICE))
    app.use((_request: Request, response: Response, next: () => void) => {
      response.setHeader('Cache-Control', 'no-store')
      response.removeHeader('X-Powered-By')
      next()
    })
    app.use(requireJsonContentType)
    app.useBodyParser('json', { limit: BODY_LIMIT })
    app.useGlobalFilters(new OpsHttpFilter())

    return app
  } catch (error) {
    await app.close().catch(() => undefined)
    throw error
  }
}
