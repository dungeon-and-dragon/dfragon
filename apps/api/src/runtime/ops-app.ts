import { type AccessLogSink, writeAccessLogToStdout } from '../presentation/http/access-log-sink.js'
import { opsFailureResponse } from '../presentation/http/ops-failures.js'
import type { HttpAppHandle } from './app-handle.js'
import { createHonoApp, createHonoAppHandle } from './hono-app.js'
import { type OpsRouteOptions, createOpsRoutes } from './routes/ops.js'

export type OpsHttpAppOptions = OpsRouteOptions & {
  /** server가 닫혀 진행 중인 요청이 모두 끝난 뒤에 부른다. */
  readonly close?: () => Promise<void>
  readonly writeAccessLog?: AccessLogSink
}

/** 운영 경로는 이 app에만 등록하고 공개 app에는 넣지 않는다. */
export function createOpsHttpApp({
  close,
  writeAccessLog = writeAccessLogToStdout,
  ...routeOptions
}: OpsHttpAppOptions): HttpAppHandle {
  const app = createHonoApp({
    accessLogService: 'api-ops',
    writeAccessLog,
    toFailureResponse: opsFailureResponse
  })
  app.route('/', createOpsRoutes(routeOptions))

  return createHonoAppHandle(app, {
    close: async (closeServer) => {
      await closeServer()
      await close?.()
    }
  })
}
