import { type AccessLogSink, writeAccessLogToStdout } from '../presentation/http/access-log.js'
import { opsFailureResponse } from '../presentation/http/ops-failures.js'
import type { HttpAppHandle } from './app-handle.js'
import { createHonoApp, createHonoAppHandle } from './hono-app.js'
import { type OpsRouteOptions, createOpsRoutes } from './modules/ops.js'

export type OpsHttpAppOptions = OpsRouteOptions & {
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

  return createHonoAppHandle(app, { close })
}
