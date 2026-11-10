import 'reflect-metadata'
import { type INestApplication, Module } from '@nestjs/common'
import type { NextFunction, Request, Response } from 'express'
import { type AccessLogSink, writeAccessLogToStdout } from '../access-log.js'
import { opsFailureResponse, unsupportedOpsMediaType } from '../presentation/http/ops-failures.js'
import { createHttpApp } from './http-app.js'
import { OpsCollectionModule, type OpsCollectionModuleOptions } from './modules/ops-collection.js'
import { OpsDatabaseModule } from './modules/ops-database.js'
import { OpsJobsModule, type OpsJobsModuleOptions } from './modules/ops-jobs.js'
import { OpsQueuesModule, type OpsQueuesModuleOptions } from './modules/ops-queues.js'

const BODY_LIMIT = '16kb'
const SAFE_METHODS = new Set(['GET', 'HEAD'])

// 로그인이 없는 운영 포트라, 소유자 브라우저에서 다른 사이트가 form으로 보내는 요청을 preflight가 필요한 JSON으로만 받아 막는다.
function requireJsonContentType(request: Request, _response: Response, next: NextFunction): void {
  const mediaType = request.headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase()
  if (SAFE_METHODS.has(request.method) || mediaType === 'application/json') {
    next()

    return
  }
  next(unsupportedOpsMediaType())
}

export type OpsHttpAppOptions = {
  readonly jobs: OpsJobsModuleOptions['store']
  readonly readQueueCounts: OpsQueuesModuleOptions['readQueueCounts']
  readonly collection: OpsCollectionModuleOptions['store']
  readonly close?: () => Promise<void>
  readonly writeAccessLog?: AccessLogSink
}

/** 운영 경로는 이 app에만 등록하고 공개 app과 OpenAPI 문서에는 넣지 않는다. */
export async function createOpsHttpApp({
  jobs,
  readQueueCounts,
  collection,
  close = async () => undefined,
  writeAccessLog = writeAccessLogToStdout
}: OpsHttpAppOptions): Promise<INestApplication> {
  @Module({
    imports: [
      OpsJobsModule.register({ store: jobs }),
      OpsQueuesModule.register({ readQueueCounts }),
      OpsCollectionModule.register({ store: collection }),
      OpsDatabaseModule.register({ close })
    ]
  })
  class OpsHttpModule {}

  return createHttpApp(OpsHttpModule, {
    accessLogService: 'api-ops',
    writeAccessLog,
    toFailureResponse: opsFailureResponse,
    configure: (app) => {
      app.use(requireJsonContentType)
      app.useBodyParser('json', { limit: BODY_LIMIT })
    }
  })
}
