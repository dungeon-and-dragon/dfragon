import {
  type DatabaseConfiguration,
  createDatabaseClient,
  readAdventureNames,
  readCharacterStatsSnapshot,
  readClearRecordLegionWeeks,
  readClearRecordRaidModes,
  readClearRecordRaidStageCounts,
  readContentClearAdventureSizes,
  readContentClearCoClears,
  readContentClearCollectedAt,
  readContentClearFameBands,
  readContentClearFames,
  readContentClearFirstWeeks,
  readContentClearJobFames,
  readContentClearJobScores,
  readContentClearPopulations,
  readContentClearRaidTimes,
  readContentClearScoreBands,
  readContentClearScores,
  readContentClearStageMoves,
  readContentClearStreaks,
  readContentClearWeekGroups,
  readContentClearWeekGroupScores,
  readContentClearWeekRatioCounts,
  readFameRanking,
  readJobSkillAdoptionSnapshot,
  readSelectedContentClearJobFames,
  readSelectedContentClearJobScores,
  readSelectedContentClearTimes,
  writeTimelineQueueCounts
} from '@dfragon/database'
import { type NeopleClient, createNeopleClient } from '@dfragon/neople'
import { createCatalogService } from '../application/character-catalog/service.js'
import type { CharacterSearchDependencies } from '../application/character-search/service.js'
import { createNeopleCharacterTimeline } from '../infrastructure/neople/character-timeline.js'
import { createDatabaseCharacterBasicStore } from '../infrastructure/database/character-basic.js'
import { backfillEnhancements } from '../application/character-timeline/backfill.js'
import {
  createDatabaseEnhancementBackfillStore,
  createDatabaseSeasonBackfillStore,
  createDatabaseTimelineStore
} from '../infrastructure/database/character-timeline-store.js'
import { backfillSeason } from '../application/character-timeline/season-backfill.js'
import {
  readCharacterTimeline,
  readTimelinePage
} from '../infrastructure/database/character-timeline-read.js'
import { ENHANCEMENT_CODES } from '../domain/character-timeline/project.js'
import { syncCharacterTimeline } from '../application/character-timeline/sync.js'
import { createNeopleCatalog } from '../infrastructure/neople/character-catalog.js'
import { createNeopleCharacterDetails } from '../infrastructure/neople/character-detail.js'
import { createNeopleCharacterSearch } from '../infrastructure/neople/character-search.js'
import { createNeopleShopGrade } from '../infrastructure/neople/today-grade.js'
import { DatabaseAdventureGuildRepository } from '../infrastructure/database/adventure-guild.js'
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
  neople: NeopleClient,
  database: DatabaseConfiguration | undefined
): Pick<
  ApiHttpAppOptions,
  | 'timeline'
  | 'recordCharacterBasic'
  | 'recordCharacterSkillStyle'
  | 'recordCharacterScore'
  | 'adventureGuild'
  | 'rankingStats'
  | 'clearStats'
> &
  Pick<CharacterSearchDependencies, 'readAdventureNames'> {
  if (database === undefined) {
    return {}
  }
  const client = createDatabaseClient(database)
  const clearStatsClient = createDatabaseClient(database, CLEAR_STATS_POOL)
  const basicStore = createDatabaseCharacterBasicStore(client)
  const fetchTimeline = createNeopleCharacterTimeline(neople)
  const store = createDatabaseTimelineStore(client)
  const backfill = {
    fetchTimeline: createNeopleCharacterTimeline(neople, ENHANCEMENT_CODES),
    store: createDatabaseEnhancementBackfillStore(client)
  }
  const seasonBackfill = { fetchTimeline, store: createDatabaseSeasonBackfillStore(client) }

  // 클리어 통계는 clearStatsClient, 나머지 option은 client를 함께 쓰며, 공개 app이 닫힐 때 `timeline.close`로 둘 다 닫는다.

  return {
    timeline: {
      sync: (character) => syncCharacterTimeline(character, { fetchTimeline, store }),
      backfillEnhancements: (character) => backfillEnhancements(character, backfill),
      backfillSeason: (job) => backfillSeason(job, seasonBackfill),
      read: (character) => readCharacterTimeline(client, character, new Date()),
      readPage: (character, list, before) => readTimelinePage(client, character, list, before),
      writeQueueCounts: (counts) => writeTimelineQueueCounts(client, counts),
      close: async () => {
        await Promise.all([client.$disconnect(), clearStatsClient.$disconnect()])
      }
    },
    recordCharacterBasic: basicStore.recordBasic,
    recordCharacterSkillStyle: basicStore.recordSkillStyle,
    recordCharacterScore: basicStore.recordScore,
    readAdventureNames: (characters) => readAdventureNames(client, characters),
    adventureGuild: new DatabaseAdventureGuildRepository(client),
    rankingStats: {
      readFameRanking: (filter, limit) => readFameRanking(client, filter, limit),
      readCharacterStatsSnapshot: () => readCharacterStatsSnapshot(client),
      readJobSkillAdoptionSnapshot: (job) => readJobSkillAdoptionSnapshot(client, job)
    },
    clearStats: {
      readCollectedAt: () => readContentClearCollectedAt(clearStatsClient),
      readPopulations: () => readContentClearPopulations(clearStatsClient),
      readWeekRatioCounts: () => readContentClearWeekRatioCounts(clearStatsClient),
      readAdventureSizes: (selection) =>
        readContentClearAdventureSizes(clearStatsClient, selection),
      readContentJobFames: (selection) =>
        readSelectedContentClearJobFames(clearStatsClient, selection),
      readContentTimes: (selection) => readSelectedContentClearTimes(clearStatsClient, selection),
      readFirstWeeks: (contentId) => readContentClearFirstWeeks(clearStatsClient, contentId),
      readFameBands: (selection, minFame) =>
        readContentClearFameBands(clearStatsClient, selection, minFame),
      readWeekGroups: (comparison) => readContentClearWeekGroups(clearStatsClient, comparison),
      readStageMoves: (selection) => readContentClearStageMoves(clearStatsClient, selection),
      readStreaks: (selection) => readContentClearStreaks(clearStatsClient, selection),
      readLegionWeeks: (names) => readClearRecordLegionWeeks(clearStatsClient, names),
      readRaidModes: (selection) => readClearRecordRaidModes(clearStatsClient, selection),
      readRaidStageCounts: (selection, stages) =>
        readClearRecordRaidStageCounts(clearStatsClient, selection, stages),
      readContentJobScores: (selection) =>
        readSelectedContentClearJobScores(clearStatsClient, selection),
      readWeekGroupScores: (comparison) =>
        readContentClearWeekGroupScores(clearStatsClient, comparison),
      readScoreBands: (selection, minFame) =>
        readContentClearScoreBands(clearStatsClient, selection, minFame),
      readScores: (weekStart) => readContentClearScores(clearStatsClient, weekStart),
      readJobScores: (weekStart) => readContentClearJobScores(clearStatsClient, weekStart),
      readFames: (weekStart) => readContentClearFames(clearStatsClient, weekStart),
      readJobFames: (weekStart) => readContentClearJobFames(clearStatsClient, weekStart),
      readCoClears: (weekStart) => readContentClearCoClears(clearStatsClient, weekStart),
      readRaidTimes: (weekStart) => readContentClearRaidTimes(clearStatsClient, weekStart)
    }
  }
}

export function createApiRuntimeOptions(configuration: RuntimeConfiguration): ApiHttpAppOptions {
  const neople = createNeopleClient(configuration.apiKey)
  const { readAdventureNames: readCandidateAdventureNames, ...database } =
    createDatabaseSubscribers(neople, configuration.database)

  return {
    search: {
      searchCharacters: createNeopleCharacterSearch(neople),
      readAdventureNames: readCandidateAdventureNames
    },
    details: {
      fetchDetails: createNeopleCharacterDetails(neople),
      catalog: createCatalogService(createNeopleCatalog(neople))
    },
    ...database,
    todayGrade: { fetchShopGrade: createNeopleShopGrade(neople) },
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
