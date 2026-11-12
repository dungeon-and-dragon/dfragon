import 'reflect-metadata'
import { Module } from '@nestjs/common'
import {
  type AccessLogSink,
  createCodeReport,
  writeAccessLogToStdout
} from '../presentation/http/access-log.js'
import { characterFailureResponse } from '../presentation/http/character-failures.js'
import { type ApiServicesOptions, createApiServices } from './api-services.js'
import { createHttpApp, createHttpAppHandle } from './http-app.js'
import { AdventureGuildModule } from './modules/adventure-guild.js'
import { CharacterDetailModule } from './modules/character-detail.js'
import { CharacterImageModule } from './modules/character-image.js'
import { CharacterSearchModule } from './modules/character-search.js'
import { CharacterTimelineModule } from './modules/character-timeline.js'
import { ClearStatsModule } from './modules/clear-stats.js'
import { HealthModule } from './modules/health.js'
import { RankingStatsModule } from './modules/ranking-stats.js'
import { TodayGradeModule } from './modules/today-grade.js'
import { VersionModule } from './modules/version.js'

export interface ApiHttpAppOptions extends ApiServicesOptions {
  readonly trustedProxyHops?: 1
  readonly httpsOptions?: Readonly<{ cert: Buffer; key: Buffer }>
  readonly writeAccessLog?: AccessLogSink
}

/** Public game data runs without authentication credentials; a database is only used for timeline sync, character basics, skill styles, adventure, guild reads and fame rankings, stats, clear stats. */
export async function createApiHttpApp(options: ApiHttpAppOptions) {
  const { writeAccessLog = writeAccessLogToStdout } = options
  const { services, readQueueCounts, close } = await createApiServices(
    options,
    createCodeReport(writeAccessLog, 'api')
  )
  @Module({
    imports: [
      HealthModule,
      VersionModule.register(services.buildInfo),
      CharacterSearchModule.register(services.search),
      CharacterDetailModule.register(services.details),
      CharacterImageModule.register(services.fetchCharacterImage),
      CharacterTimelineModule.register(services.timeline),
      AdventureGuildModule.register(services.adventureGuild),
      RankingStatsModule.register(services.rankingStats),
      ClearStatsModule.register(services.clearStats),
      TodayGradeModule.register(services.todayGrade)
    ]
  })
  class ApiHttpModule {}

  const app = await createHttpApp(ApiHttpModule, {
    accessLogService: 'api',
    writeAccessLog,
    toFailureResponse: characterFailureResponse,
    httpsOptions: options.httpsOptions,
    configure: (app) => {
      app.set('trust proxy', options.trustedProxyHops ?? false)
    }
  }).catch(async (error: unknown) => {
    // server를 만들지 못해도 이미 띄운 점수 worker가 process를 붙잡지 않게 멈춘다.
    await close(async () => undefined).catch(() => undefined)
    throw error
  })

  return {
    app: createHttpAppHandle(app, () => close(() => app.close())),
    readQueueCounts
  }
}
