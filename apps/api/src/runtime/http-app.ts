import type { Type } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import type { Request, Response } from 'express'
import { type AccessLogSink, createAccessLog } from '../presentation/http/access-log.js'
import {
  type FailureResponse,
  FailureResponseFilter
} from '../presentation/http/failure-response.js'
import type { HttpAppHandle } from './app-handle.js'

const nestAppsForTest = new WeakMap<HttpAppHandle, NestExpressApplication>()

export function createHttpAppHandle(
  app: NestExpressApplication,
  close: () => Promise<void> = () => app.close()
): HttpAppHandle {
  const handle: HttpAppHandle = {
    listen: async (port, hostname) => {
      if (hostname !== undefined) {
        await app.listen(port, hostname)
      } else {
        await app.listen(port)
      }
    },
    getUrl: () => app.getUrl(),
    close,
    getHttpServer: () => app.getHttpServer()
  }
  nestAppsForTest.set(handle, app)

  return handle
}

// 테스트에서만 쓰며 Nest를 제거할 때 함께 지운다.
export function getNestAppForTest(handle: HttpAppHandle): NestExpressApplication {
  const app = nestAppsForTest.get(handle)
  if (app === undefined) {
    throw new Error('HTTP app handle does not belong to a Nest app')
  }

  return app
}

export interface HttpAppOptions {
  readonly accessLogService: string
  readonly writeAccessLog: AccessLogSink
  readonly toFailureResponse: (error: unknown) => FailureResponse
  readonly httpsOptions?: Readonly<{ cert: Buffer; key: Buffer }>
}

function setCommonHeaders(_request: Request, response: Response, next: () => void): void {
  response.setHeader('Cache-Control', 'no-store')
  response.removeHeader('X-Powered-By')
  next()
}

export async function createHttpApp(
  module: Type,
  { accessLogService, writeAccessLog, toFailureResponse, httpsOptions }: HttpAppOptions
): Promise<NestExpressApplication> {
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

    return app
  } catch (error) {
    await app.close().catch(() => undefined)
    throw error
  }
}
