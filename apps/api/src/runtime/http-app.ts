import type { INestApplication, Type } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import type { Request, Response } from 'express'
import { type AccessLogSink, createAccessLog } from '../access-log.js'
import {
  type FailureResponse,
  FailureResponseFilter
} from '../presentation/http/failure-response.js'

export interface HttpAppOptions {
  readonly accessLogService: string
  readonly writeAccessLog: AccessLogSink
  readonly toFailureResponse: (error: unknown) => FailureResponse
  readonly httpsOptions?: Readonly<{ cert: Buffer; key: Buffer }>
  readonly configure: (app: NestExpressApplication) => void
}

function setCommonHeaders(_request: Request, response: Response, next: () => void): void {
  response.setHeader('Cache-Control', 'no-store')
  response.removeHeader('X-Powered-By')
  next()
}

export async function createHttpApp(
  module: Type,
  { accessLogService, writeAccessLog, toFailureResponse, httpsOptions, configure }: HttpAppOptions
): Promise<INestApplication> {
  const app = await NestFactory.create<NestExpressApplication>(module, {
    logger: false,
    bodyParser: false,
    abortOnError: false,
    httpsOptions
  })
  try {
    // Nest 기본 logger는 끈 채로 두고, 다른 middleware의 거절까지 재도록 가장 먼저 등록한다.
    app.use(createAccessLog(writeAccessLog, accessLogService))
    app.use(setCommonHeaders)
    app.useGlobalFilters(new FailureResponseFilter(toFailureResponse))
    configure(app)

    return app
  } catch (error) {
    await app.close().catch(() => undefined)
    throw error
  }
}
