import 'reflect-metadata'
import { Catch, Controller, Get, Module, NotFoundException } from '@nestjs/common'
import type { ArgumentsHost, ExceptionFilter, INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import type { Request, Response } from 'express'
import { CHARACTER_SEARCH_SERVICE, CharacterSearchController } from './characters/http.js'
import { createCharacterSearchService } from './characters/search-service.js'
import type { CharacterSearchDependencies } from './characters/types.js'
import { CHARACTER_DETAIL_SERVICE, CharacterDetailController } from './characters/details/http.js'
import { createCharacterDetailService } from './characters/details/service.js'
import type { CharacterDetailDependencies } from './characters/details/service.js'
import { characterDetailFailure } from './characters/details/errors.js'
import { CHARACTER_IMAGE_FETCH, CharacterImageController } from './characters/image/http.js'
import { type FetchCharacterImage, createNeopleCharacterImage } from './characters/image/neople.js'
import { NeopleSearchFailure } from './errors/neople-search.js'
import { TODAY_GRADE_SERVICE, TodayGradeController } from './today-grade/http.js'
import { createTodayGradeService } from './today-grade/service.js'
import type { FetchShopGrade } from './today-grade/neople.js'
import { type TodayGradeFailure, todayGradeFailure } from './today-grade/errors.js'
import { setupSwagger } from './swagger/setup.js'
import { createTimelineSyncQueue } from './characters/timeline/queue.js'
import type { TimelineCharacter } from '@dfragon/database'
import { API_BUILD_INFO, ApiVersionController, readApiBuildInfo } from './build-info.js'
import { SCORE_ENGINE, type ScoreEngine, createScoreEngine } from './score/engine.js'
import {
  type AccessLogSink,
  createAccessLog,
  recordAccessLogErrorChain,
  recordAccessLogErrorCode,
  writeAccessLogToStdout
} from './access-log.js'

const TRAILING_SLASHES_PATTERN = /\/+$/
const WEB_ORIGINS = ['https://dfragon.com', 'https://dev.dfragon.com']
const CORS_ORIGIN_METHODS = new Set(['GET', 'OPTIONS'])
const TIMELINE_SYNC_CLOSE = Symbol('TIMELINE_SYNC_CLOSE')

function requestFailure(
  path: string,
  error: unknown
): NeopleSearchFailure | TodayGradeFailure | ReturnType<typeof characterDetailFailure> {
  if (path === '/characters' || path === '/characters/candidates') {
    if (error instanceof NeopleSearchFailure) {
      return error
    }

    return new NeopleSearchFailure('internal')
  }

  if (path === '/items/today-grade') {
    return todayGradeFailure(error)
  }

  return characterDetailFailure(error)
}

@Catch()
class ApiHttpFilter implements ExceptionFilter {
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
    const path = request.path.toLowerCase().replace(TRAILING_SLASHES_PATTERN, '')
    const failure = requestFailure(path, error)

    recordAccessLogErrorCode(response, failure.body.error.code)
    recordAccessLogErrorChain(response, error)
    response.status(failure.status).json(failure.body)
  }
}

@Controller('health')
class HealthController {
  @Get()
  health() {
    return { status: 'ok' }
  }
}

export interface TimelineSyncOptions {
  readonly sync: (character: TimelineCharacter) => Promise<void>
  // 진행 중인 동기화를 기다리지 않고 닫는다.
  readonly close: () => Promise<void>
}

export interface ApiHttpAppOptions {
  readonly search: CharacterSearchDependencies
  readonly details: Omit<CharacterDetailDependencies, 'calculateScore' | 'requestTimelineSync'>
  readonly timeline?: TimelineSyncOptions
  readonly todayGrade: { fetchShopGrade: FetchShopGrade }
  readonly fetchCharacterImage?: FetchCharacterImage
  readonly webDevOrigins?: readonly string[]
  readonly trustedProxyHops?: 1
  readonly httpsOptions?: Readonly<{ cert: Buffer; key: Buffer }>
  readonly buildInfoPath?: string
  readonly writeAccessLog?: AccessLogSink
  readonly scoreLibraryPath?: string | null
}

/** Public game data runs without authentication credentials; a database is only used for timeline sync. */
export async function createApiHttpApp({
  search,
  details,
  timeline,
  todayGrade,
  fetchCharacterImage = createNeopleCharacterImage(),
  webDevOrigins = [],
  trustedProxyHops,
  httpsOptions,
  buildInfoPath = '/app/build-info.json',
  writeAccessLog = writeAccessLogToStdout,
  scoreLibraryPath = null
}: ApiHttpAppOptions): Promise<INestApplication> {
  const buildInfo = await readApiBuildInfo(buildInfoPath)
  const reportCode = (code: string) =>
    writeAccessLog(JSON.stringify({ time: new Date().toISOString(), service: 'api', code }))
  const timelineQueue =
    timeline && createTimelineSyncQueue(timeline.sync, () => reportCode('TIMELINE_SYNC_FAILED'))
  @Module({
    controllers: [
      HealthController,
      ApiVersionController,
      CharacterSearchController,
      CharacterDetailController,
      CharacterImageController,
      TodayGradeController
    ],
    providers: [
      { provide: API_BUILD_INFO, useValue: buildInfo },
      { provide: CHARACTER_SEARCH_SERVICE, useValue: createCharacterSearchService(search) },
      {
        provide: CHARACTER_DETAIL_SERVICE,
        inject: [SCORE_ENGINE],
        useFactory: (engine: ScoreEngine) =>
          createCharacterDetailService({
            ...details,
            calculateScore: engine.calculate,
            requestTimelineSync: timelineQueue?.request
          })
      },
      {
        provide: TIMELINE_SYNC_CLOSE,
        useValue: {
          onApplicationShutdown: () => {
            // Prisma는 닫은 뒤에도 다음 query에서 다시 연결하므로, 대기열이 남으면 종료 뒤에도 계속 꺼내 받는다.
            timelineQueue?.close()

            return timeline?.close()
          }
        }
      },
      { provide: CHARACTER_IMAGE_FETCH, useValue: fetchCharacterImage },
      {
        provide: TODAY_GRADE_SERVICE,
        useValue: createTodayGradeService(todayGrade.fetchShopGrade)
      },
      {
        provide: SCORE_ENGINE,
        // worker는 listen을 기다리지 않고 시작해 준비 계산을 하며, 그동안 온 계산은 worker에 쌓였다가 차례로 계산된다.
        useFactory: () =>
          createScoreEngine({
            path: scoreLibraryPath,
            report: reportCode
          })
      }
    ]
  })
  class ApiHttpModule {}
  const app = await NestFactory.create<NestExpressApplication>(ApiHttpModule, {
    logger: false,
    bodyParser: false,
    abortOnError: false,
    httpsOptions
  })
  try {
    app.set('trust proxy', trustedProxyHops ?? false)
    // Nest 기본 logger는 끈 채로 두고, 다른 middleware의 거절까지 재도록 가장 먼저 등록한다.
    app.use(createAccessLog(writeAccessLog))
    app.use((_request: Request, response: Response, next: () => void) => {
      response.setHeader('Cache-Control', 'no-store')
      response.removeHeader('X-Powered-By')
      next()
    })
    const corsOrigins = [...WEB_ORIGINS, ...webDevOrigins]
    // cors의 `methods`는 preflight 응답만 제한하므로, preflight 없는 simple POST에는 origin을 허용하지 않게 요청마다 고른다.
    app.enableCors((request: Request, callback) => {
      const origin = CORS_ORIGIN_METHODS.has(request.method) && corsOrigins
      callback(null, { origin, methods: ['GET'] })
    })
    app.useGlobalFilters(new ApiHttpFilter())
    setupSwagger(app)

    return app
  } catch (error) {
    await app.close().catch(() => undefined)
    throw error
  }
}
