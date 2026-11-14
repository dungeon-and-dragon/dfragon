import { type Server, createServer } from 'node:http'
import { createServer as createHttpsServer } from 'node:https'
import { getRequestListener } from '@hono/node-server'
import { Hono } from 'hono'
import { type AccessLogEnv, createAccessLog } from './access-log.js'
import type { AccessLogSink } from './access-log-sink.js'
import { setCommonHeaders } from './common-headers.js'
import {
  type FailureResponse,
  createFailureHandler,
  notFoundResponse,
  respondToThrownValues
} from './failure-response.js'
import type { HttpAppHandle } from './app-handle.js'

export interface HonoAppOptions {
  readonly accessLogService: string
  readonly writeAccessLog: AccessLogSink
  readonly toFailureResponse: (error: unknown) => FailureResponse
}

export function createHonoApp({
  accessLogService,
  writeAccessLog,
  toFailureResponse
}: HonoAppOptions): Hono<AccessLogEnv> {
  const handleFailure = createFailureHandler(toFailureResponse)
  // 끝의 `/`가 있어도 같은 경로로 본다.
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
  /** handle을 닫을 때 부른다. server를 닫는 `closeServer`를 어느 단계에서 부를지 정한다. 없으면 server만 닫는다. */
  readonly close?: (closeServer: () => Promise<void>) => Promise<void>
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
  { httpsOptions, close = (closeServer) => closeServer() }: HonoAppHandleOptions = {}
): HttpAppHandle {
  const server = createNodeServer(app, httpsOptions)
  const protocol = httpsOptions !== undefined ? 'https' : 'http'
  // 열린 요청이 모두 끝나야 끝난다. listen 전에 닫아도 실패하지 않도록 server가 넘기는 오류(ERR_SERVER_NOT_RUNNING)는 버린다.
  const closeServer = () =>
    new Promise<void>((resolve) => {
      server.close(() => resolve())
    })

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
    close: () => close(closeServer),
    getHttpServer: () => server
  }
}
