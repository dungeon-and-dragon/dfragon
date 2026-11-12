import { type Server, createServer } from 'node:http'
import { createServer as createHttpsServer } from 'node:https'
import { getRequestListener } from '@hono/node-server'
import { Hono, type MiddlewareHandler } from 'hono'
import type { AccessLogSink } from '../presentation/http/access-log-entry.js'
import type { FailureResponse } from '../presentation/http/failure-response.js'
import { type AccessLogEnv, createAccessLog } from '../presentation/http/hono-access-log.js'
import {
  createFailureHandler,
  notFoundResponse,
  respondToThrownValues
} from '../presentation/http/hono-failure-response.js'
import type { HttpAppHandle } from './app-handle.js'

export interface HonoAppOptions {
  readonly accessLogService: string
  readonly writeAccessLog: AccessLogSink
  readonly toFailureResponse: (error: unknown) => FailureResponse
}

const setCommonHeaders: MiddlewareHandler = async (c, next) => {
  await next()
  if (!c.res.headers.has('Cache-Control')) {
    c.res.headers.set('Cache-Control', 'no-store')
  }
}

export function createHonoApp({
  accessLogService,
  writeAccessLog,
  toFailureResponse
}: HonoAppOptions): Hono<AccessLogEnv> {
  const handleFailure = createFailureHandler(toFailureResponse)
  // express처럼 끝의 `/`가 있어도 같은 경로로 본다.
  const app = new Hono<AccessLogEnv>({ strict: false })
  app.use(createAccessLog(writeAccessLog, accessLogService))
  app.use(setCommonHeaders)
  app.use(respondToThrownValues(handleFailure))
  app.onError(handleFailure)
  app.notFound(notFoundResponse)

  return app
}

export interface HonoAppHandleOptions {
  readonly httpsOptions?: Readonly<{ cert: Buffer; key: Buffer }>
  /** server가 닫혀 진행 중인 요청이 모두 끝난 뒤에 부른다. */
  readonly close?: () => Promise<void>
}

function createNodeServer(
  app: Hono<AccessLogEnv>,
  httpsOptions: HonoAppHandleOptions['httpsOptions']
): Server {
  // 이 호출이 process 전체의 Request, Response를 node-server 구현으로 바꾼다. 끄면(overrideGlobalObjects)
  // Hono middleware가 요청을 다시 만들 때(`new Request(c.req.raw)`) 실패하므로 기본값을 쓴다.
  const listener = getRequestListener(app.fetch)
  if (httpsOptions !== undefined) {
    return createHttpsServer(httpsOptions, listener)
  }

  return createServer(listener)
}

export function createHonoAppHandle(
  app: Hono<AccessLogEnv>,
  { httpsOptions, close }: HonoAppHandleOptions = {}
): HttpAppHandle {
  const server = createNodeServer(app, httpsOptions)
  const protocol = httpsOptions !== undefined ? 'https' : 'http'

  return {
    listen: (port, hostname) =>
      new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(port, hostname, () => {
          server.off('error', reject)
          resolve()
        })
      }),
    getUrl: async () => {
      const address = server.address()
      if (address === null || typeof address === 'string') {
        throw new Error('HTTP app is not listening on a port')
      }
      const host = address.family === 'IPv6' ? `[${address.address}]` : address.address

      return `${protocol}://${host}:${address.port}`
    },
    close: async () => {
      // listen 전에 닫아도 실패하지 않도록 server가 넘기는 오류(ERR_SERVER_NOT_RUNNING)는 버린다.
      await new Promise<void>((resolve) => {
        server.close(() => resolve())
      })
      await close?.()
    },
    getHttpServer: () => server
  }
}
