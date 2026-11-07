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
import { type TimelineSyncQueue, createTimelineSyncQueue } from './characters/timeline/queue.js'
import {
  type SeasonBackfillJob,
  type SeasonBackfillQueue,
  createSeasonBackfillQueue
} from './characters/timeline/season-backfill.js'
import {
  CHARACTER_TIMELINE_SERVICE,
  CharacterTimelineController
} from './characters/timeline/http.js'
import type { CharacterTimeline } from './characters/timeline/read.js'
import {
  createCharacterTimelineService,
  emptyCharacterTimelineService,
  type ReadTimelinePage
} from './characters/timeline/service.js'
import { TimelineSyncSubscriber } from './characters/timeline/subscriber.js'
import {
  CharacterBasicSubscriber,
  type RecordCharacterBasic,
  type RecordCharacterSkillStyle
} from './characters/basic/subscriber.js'
import { CharacterEvents } from './characters/events.js'
import { ADVENTURE_GUILD_SERVICE, AdventureGuildController } from './adventure-guild/http.js'
import {
  type AdventureGuildReader,
  createAdventureGuildService,
  emptyAdventureGuildService,
  noSeasonBackfill
} from './adventure-guild/service.js'
import { RANKING_STATS_SERVICE, RankingStatsController } from './ranking-stats/http.js'
import {
  type RankingStatsReader,
  createRankingStatsService,
  emptyRankingStatsReader
} from './ranking-stats/service.js'
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter'
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
const TIMELINE_SYNC_QUEUE = Symbol('TIMELINE_SYNC_QUEUE')
const SEASON_BACKFILL_QUEUE = Symbol('SEASON_BACKFILL_QUEUE')

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
  readonly backfillEnhancements: (character: TimelineCharacter) => Promise<void>
  readonly backfillSeason: (job: SeasonBackfillJob) => Promise<void>
  readonly read: (character: TimelineCharacter) => Promise<CharacterTimeline>
  readonly readPage: ReadTimelinePage
  // 진행 중인 동기화를 기다리지 않고 닫는다.
  readonly close: () => Promise<void>
}

export interface ApiHttpAppOptions {
  readonly search: CharacterSearchDependencies
  readonly details: Omit<CharacterDetailDependencies, 'calculateScore' | 'characterEvents'>
  readonly timeline?: TimelineSyncOptions
  readonly recordCharacterBasic?: RecordCharacterBasic
  readonly recordCharacterSkillStyle?: RecordCharacterSkillStyle
  readonly adventureGuild?: AdventureGuildReader
  readonly rankingStats?: RankingStatsReader
  readonly todayGrade: { fetchShopGrade: FetchShopGrade }
  readonly fetchCharacterImage?: FetchCharacterImage
  readonly trustedProxyHops?: 1
  readonly httpsOptions?: Readonly<{ cert: Buffer; key: Buffer }>
  readonly buildInfoPath?: string
  readonly writeAccessLog?: AccessLogSink
  readonly scoreLibraryPath?: string | null
}

/** Public game data runs without authentication credentials; a database is only used for timeline sync, character basics, skill styles, adventure, guild reads and fame rankings, stats. */
export async function createApiHttpApp({
  search,
  details,
  timeline,
  recordCharacterBasic,
  recordCharacterSkillStyle,
  adventureGuild,
  rankingStats,
  todayGrade,
  fetchCharacterImage = createNeopleCharacterImage(),
  trustedProxyHops,
  httpsOptions,
  buildInfoPath = '/app/build-info.json',
  writeAccessLog = writeAccessLogToStdout,
  scoreLibraryPath = null
}: ApiHttpAppOptions): Promise<INestApplication> {
  const buildInfo = await readApiBuildInfo(buildInfoPath)
  const reportCode = (code: string) =>
    writeAccessLog(JSON.stringify({ time: new Date().toISOString(), service: 'api', code }))
  // DB 설정이 없으면 구독자를 등록하지 않아, 상세 조회가 낸 이벤트를 받는 곳이 없다.
  const timelineProviders = timeline
    ? [
        {
          provide: TIMELINE_SYNC_QUEUE,
          useFactory: () =>
            createTimelineSyncQueue(timeline.sync, () => reportCode('TIMELINE_SYNC_FAILED'))
        },
        {
          provide: SEASON_BACKFILL_QUEUE,
          useFactory: () =>
            createSeasonBackfillQueue(timeline.backfillSeason, () =>
              reportCode('TIMELINE_SEASON_BACKFILL_FAILED')
            )
        },
        {
          provide: TimelineSyncSubscriber,
          inject: [TIMELINE_SYNC_QUEUE, SEASON_BACKFILL_QUEUE],
          // 타임라인 조회가 백필을 기다리지 않도록 백필은 따로 queue를 둔다.
          useFactory: (queue: TimelineSyncQueue, seasonBackfillQueue: SeasonBackfillQueue) =>
            new TimelineSyncSubscriber(
              queue,
              createTimelineSyncQueue(timeline.backfillEnhancements, () =>
                reportCode('TIMELINE_BACKFILL_FAILED')
              ),
              seasonBackfillQueue,
              timeline.close
            )
        },
        {
          provide: CHARACTER_TIMELINE_SERVICE,
          inject: [TIMELINE_SYNC_QUEUE],
          useFactory: (queue: TimelineSyncQueue) =>
            createCharacterTimelineService(queue, timeline.read, timeline.readPage)
        }
      ]
    : [{ provide: CHARACTER_TIMELINE_SERVICE, useValue: emptyCharacterTimelineService }]
  const characterBasicProviders = recordCharacterBasic
    ? [
        {
          provide: CharacterBasicSubscriber,
          useFactory: () =>
            new CharacterBasicSubscriber(
              recordCharacterBasic,
              recordCharacterSkillStyle,
              reportCode
            )
        }
      ]
    : []
  @Module({
    imports: [EventEmitterModule.forRoot()],
    controllers: [
      HealthController,
      ApiVersionController,
      CharacterSearchController,
      CharacterDetailController,
      CharacterImageController,
      CharacterTimelineController,
      AdventureGuildController,
      RankingStatsController,
      TodayGradeController
    ],
    providers: [
      { provide: API_BUILD_INFO, useValue: buildInfo },
      { provide: CHARACTER_SEARCH_SERVICE, useValue: createCharacterSearchService(search) },
      {
        provide: CHARACTER_DETAIL_SERVICE,
        inject: [SCORE_ENGINE, EventEmitter2],
        useFactory: (engine: ScoreEngine, emitter: EventEmitter2) =>
          createCharacterDetailService({
            ...details,
            calculateScore: engine.calculate,
            characterEvents: new CharacterEvents(emitter)
          })
      },
      ...timelineProviders,
      ...characterBasicProviders,
      { provide: CHARACTER_IMAGE_FETCH, useValue: fetchCharacterImage },
      {
        provide: ADVENTURE_GUILD_SERVICE,
        // 타임라인 queue는 DB 설정이 있을 때만 있어, 테스트처럼 모험단 읽기만 준 앱은 동기화를 요청하지 않는다.
        inject: [
          { token: TIMELINE_SYNC_QUEUE, optional: true },
          { token: SEASON_BACKFILL_QUEUE, optional: true }
        ],
        useFactory: (
          queue: TimelineSyncQueue | undefined,
          seasonBackfillQueue: SeasonBackfillQueue | undefined
        ) => {
          if (!adventureGuild) {
            return emptyAdventureGuildService
          }
          const requestTimelineSync = queue?.request ?? (() => undefined)
          const seasonBackfill = seasonBackfillQueue ?? noSeasonBackfill

          return createAdventureGuildService(adventureGuild, requestTimelineSync, seasonBackfill)
        }
      },
      {
        provide: RANKING_STATS_SERVICE,
        useValue: createRankingStatsService(rankingStats ?? emptyRankingStatsReader)
      },
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
    app.useGlobalFilters(new ApiHttpFilter())
    setupSwagger(app)

    return app
  } catch (error) {
    await app.close().catch(() => undefined)
    throw error
  }
}
