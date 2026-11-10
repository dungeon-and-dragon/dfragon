import 'reflect-metadata'
import { type INestApplication, Module } from '@nestjs/common'
import { EventEmitterModule } from '@nestjs/event-emitter'
import {
  type AccessLogSink,
  createCodeReport,
  writeAccessLogToStdout
} from '../presentation/http/access-log.js'
import { characterFailureResponse } from '../presentation/http/character-failures.js'
import { createHttpApp } from './http-app.js'
import {
  AdventureGuildModule,
  type AdventureGuildModuleOptions
} from './modules/adventure-guild.js'
import {
  CharacterBasicModule,
  type CharacterBasicModuleOptions
} from './modules/character-basic.js'
import {
  CharacterDetailModule,
  type CharacterDetailModuleOptions
} from './modules/character-detail.js'
import {
  CharacterImageModule,
  type CharacterImageModuleOptions
} from './modules/character-image.js'
import {
  CharacterSearchModule,
  type CharacterSearchModuleOptions
} from './modules/character-search.js'
import {
  CharacterTimelineModule,
  type CharacterTimelineModuleOptions
} from './modules/character-timeline.js'
import { ClearStatsModule, type ClearStatsModuleOptions } from './modules/clear-stats.js'
import { HealthModule } from './modules/health.js'
import { RankingStatsModule, type RankingStatsModuleOptions } from './modules/ranking-stats.js'
import { ScoreEngineModule, type ScoreEngineModuleOptions } from './modules/score-engine.js'
import { TodayGradeModule, type TodayGradeModuleOptions } from './modules/today-grade.js'
import { VersionModule, type VersionModuleOptions } from './modules/version.js'
import { setupSwagger } from '../presentation/openapi/setup.js'

export interface ApiHttpAppOptions {
  readonly search: CharacterSearchModuleOptions
  readonly details: CharacterDetailModuleOptions
  readonly timeline?: CharacterTimelineModuleOptions['timeline']
  readonly recordCharacterBasic?: CharacterBasicModuleOptions['recordCharacterBasic']
  readonly recordCharacterSkillStyle?: CharacterBasicModuleOptions['recordCharacterSkillStyle']
  readonly adventureGuild?: AdventureGuildModuleOptions['reader']
  readonly rankingStats?: RankingStatsModuleOptions['reader']
  readonly clearStats?: ClearStatsModuleOptions['reader']
  readonly todayGrade: TodayGradeModuleOptions
  readonly fetchCharacterImage?: CharacterImageModuleOptions['fetchCharacterImage']
  readonly trustedProxyHops?: 1
  readonly httpsOptions?: Readonly<{ cert: Buffer; key: Buffer }>
  readonly buildInfoPath?: VersionModuleOptions['buildInfoPath']
  readonly writeAccessLog?: AccessLogSink
  readonly scoreLibraryPath?: ScoreEngineModuleOptions['libraryPath']
}

/** Public game data runs without authentication credentials; a database is only used for timeline sync, character basics, skill styles, adventure, guild reads and fame rankings, stats, clear stats. */
export async function createApiHttpApp(options: ApiHttpAppOptions): Promise<INestApplication> {
  const { writeAccessLog = writeAccessLogToStdout } = options
  const reportCode = createCodeReport(writeAccessLog, 'api')
  @Module({
    imports: [
      EventEmitterModule.forRoot(),
      HealthModule,
      VersionModule.register({ buildInfoPath: options.buildInfoPath }),
      ScoreEngineModule.register({ libraryPath: options.scoreLibraryPath ?? null, reportCode }),
      CharacterSearchModule.register(options.search),
      CharacterDetailModule.register(options.details),
      CharacterImageModule.register({ fetchCharacterImage: options.fetchCharacterImage }),
      CharacterTimelineModule.register({ timeline: options.timeline, reportCode }),
      CharacterBasicModule.register({
        recordCharacterBasic: options.recordCharacterBasic,
        recordCharacterSkillStyle: options.recordCharacterSkillStyle,
        reportCode
      }),
      AdventureGuildModule.register({ reader: options.adventureGuild }),
      RankingStatsModule.register({ reader: options.rankingStats }),
      ClearStatsModule.register({ reader: options.clearStats }),
      TodayGradeModule.register(options.todayGrade)
    ]
  })
  class ApiHttpModule {}

  return createHttpApp(ApiHttpModule, {
    accessLogService: 'api',
    writeAccessLog,
    toFailureResponse: characterFailureResponse,
    httpsOptions: options.httpsOptions,
    configure: (app) => {
      app.set('trust proxy', options.trustedProxyHops ?? false)
      setupSwagger(app)
    }
  })
}
