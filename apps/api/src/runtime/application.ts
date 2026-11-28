import { type DatabaseConfiguration, createDatabaseClient } from '@dfragon/database'
import { createNeopleClient } from '@dfragon/neople'
import { CatalogService } from '@dfragon/server-core/application/character-catalog/index.js'
import {
  createNeopleCatalog,
  createNeopleCharacterDetails,
  createNeopleItemSearch
} from '@dfragon/server-core/infrastructure/neople/index.js'
import {
  DatabaseAdventureGuildRepository,
  DatabaseCharacterBasicRepository,
  DatabaseCharacterHistoryRepository,
  DatabaseCharacterSearchRepository,
  DatabaseLabItemRepository,
  DatabaseRankingStatsRepository,
  DatabaseTimelineSyncRequestRepository
} from '#infrastructure/database/index.js'
import {
  createNeopleCharacterSearch,
  createNeopleLowestListing,
  createNeopleShopGrade
} from '#infrastructure/neople/index.js'
import { DatabaseClearStatsRepository } from '@dfragon/server-core/infrastructure/database/index.js'
import { type ApiHttpAppOptions, createApiHttpApp } from './api-app.js'
import type { readRuntimeConfiguration } from './configuration.js'

type RuntimeConfiguration = Awaited<ReturnType<typeof readRuntimeConfiguration>>

// 클리어 통계는 계산을 한 번에 하나씩 돌리고(연결 1개), 마지막 수집 시각 읽기에 1개를 남긴다. 따로 둔 풀이라 통계 쿼리가
// 오래 걸려도 다른 경로의 연결을 잡지 않는다. pg 기본값은 연결을 끝없이 기다리므로 대기에도 상한을 둔다.
// 운영의 첫 계산은 쿼리 12개를 함께 보낸 상세 하나가 길어야 55초였으므로, 쿼리 하나가 3분을 넘으면 비정상으로 보고 끊는다.
const CLEAR_STATS_POOL = {
  maxConnections: 2,
  connectionTimeoutMs: 10_000,
  statementTimeoutMs: 180_000
}

function createDatabaseSubscribers(
  database: DatabaseConfiguration | undefined
): Pick<
  ApiHttpAppOptions,
  | 'timeline'
  | 'recordCharacterBasic'
  | 'recordCharacterSkillStyle'
  | 'recordCharacterScore'
  | 'recordCharacterHistory'
  | 'recordCharacterSets'
  | 'characterHistory'
  | 'adventureGuild'
  | 'rankingStats'
  | 'labItems'
  | 'clearStats'
> &
  Pick<ApiHttpAppOptions['search'], 'readAdventureNames' | 'readCharacterScores'> {
  if (database === undefined) {
    return {}
  }
  const client = createDatabaseClient(database)
  const clearStatsClient = createDatabaseClient(database, CLEAR_STATS_POOL)
  const characterBasic = new DatabaseCharacterBasicRepository(client)
  const characterSearch = new DatabaseCharacterSearchRepository(client)

  // 클리어 통계는 clearStatsClient, 나머지 option은 client를 함께 쓰며, 공개 app이 닫힐 때 `timeline.close`로 모두 닫는다.

  return {
    timeline: {
      requests: new DatabaseTimelineSyncRequestRepository(client),
      close: async () => {
        await Promise.all([client.$disconnect(), clearStatsClient.$disconnect()])
      }
    },
    recordCharacterBasic: (basic) => characterBasic.recordBasic(basic),
    recordCharacterSkillStyle: (style) => characterBasic.recordSkillStyle(style),
    recordCharacterScore: (score) => characterBasic.recordScore(score),
    recordCharacterHistory: (history) => characterBasic.recordHistory(history),
    recordCharacterSets: (sets) => characterBasic.recordSets(sets),
    characterHistory: new DatabaseCharacterHistoryRepository(client),
    readAdventureNames: (characters) => characterSearch.readAdventureNames(characters),
    readCharacterScores: (characters) => characterSearch.readCharacterScores(characters),
    adventureGuild: new DatabaseAdventureGuildRepository(client),
    rankingStats: new DatabaseRankingStatsRepository(client),
    labItems: new DatabaseLabItemRepository(client),
    clearStats: new DatabaseClearStatsRepository(clearStatsClient)
  }
}

export function createApiRuntimeOptions(configuration: RuntimeConfiguration): ApiHttpAppOptions {
  const neople = createNeopleClient(configuration.apiKey)
  const {
    readAdventureNames: readCandidateAdventureNames,
    readCharacterScores,
    ...database
  } = createDatabaseSubscribers(configuration.database)

  return {
    search: {
      searchCharacters: createNeopleCharacterSearch(neople),
      readAdventureNames: readCandidateAdventureNames,
      readCharacterScores
    },
    details: {
      fetchDetails: createNeopleCharacterDetails(neople),
      catalog: new CatalogService(createNeopleCatalog(neople))
    },
    ...database,
    todayGrade: { fetchShopGrade: createNeopleShopGrade(neople) },
    soulPrices: { fetchLowestListing: createNeopleLowestListing(neople) },
    findGameItem: createNeopleItemSearch(neople),
    httpsOptions: configuration.localHttps,
    scoreLibraryPath: configuration.scoreLibraryPath
  }
}

export async function createApiRuntime(configuration: RuntimeConfiguration) {
  const runtime = await createApiHttpApp(createApiRuntimeOptions(configuration))

  // 첫 요청이 계산을 기다리지 않게 listen을 기다리지 않고 최신 주를 미리 계산한다. 실패는 진단 code로 남고 던지지 않는다.
  runtime.refreshClearStats()

  return runtime
}
