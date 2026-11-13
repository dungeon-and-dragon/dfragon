import {
  type DatabaseConfiguration,
  addBatchNeopleKey,
  createDatabaseClient,
  deleteBatchNeopleKey,
  readBatchNeopleKeys,
  readAdventureCharacters,
  readAdventureNames,
  readCharacterStatsSnapshot,
  readContentClearAdventureSizes,
  readContentClearCoClears,
  readContentClearCollectedAt,
  readContentClearFames,
  readContentClearJobCounts,
  readContentClearJobFames,
  readContentClearPopulations,
  readContentClearRaidTimes,
  readContentClearWeekRatioCounts,
  readFameRanking,
  readGuild,
  readCollectionSummary,
  readJobOverviews,
  readJobRuns,
  readJobSkillAdoptionSnapshot,
  requestJobRun,
  requeueCollectionFailures,
  setBatchNeopleKeyEnabled,
  setJobPaused
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
import {
  readAdventureActivity,
  readAdventureSeasonDays,
  readAdventureSeasonBackfill
} from '../infrastructure/database/adventure-activity.js'
import { readAdventureWeeklyClears } from '../infrastructure/database/adventure-weekly.js'
import { type ApiHttpAppOptions, createApiHttpApp } from './api-app.js'
import { createOpsHttpApp } from './ops-app.js'
import type { ReadQueueCounts } from '../application/ops/ports.js'
import type { readRuntimeConfiguration } from './configuration.js'

type RuntimeConfiguration = Awaited<ReturnType<typeof readRuntimeConfiguration>>

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
  const basicStore = createDatabaseCharacterBasicStore(client)
  const fetchTimeline = createNeopleCharacterTimeline(neople)
  const store = createDatabaseTimelineStore(client)
  const backfill = {
    fetchTimeline: createNeopleCharacterTimeline(neople, ENHANCEMENT_CODES),
    store: createDatabaseEnhancementBackfillStore(client)
  }
  const seasonBackfill = { fetchTimeline, store: createDatabaseSeasonBackfillStore(client) }

  // 아래 option이 client 하나를 함께 쓰며, 공개 app이 닫힐 때 `timeline.close`로 닫는다.

  return {
    timeline: {
      sync: (character) => syncCharacterTimeline(character, { fetchTimeline, store }),
      backfillEnhancements: (character) => backfillEnhancements(character, backfill),
      backfillSeason: (job) => backfillSeason(job, seasonBackfill),
      read: (character) => readCharacterTimeline(client, character, new Date()),
      readPage: (character, list, before) => readTimelinePage(client, character, list, before),
      close: () => client.$disconnect()
    },
    recordCharacterBasic: basicStore.recordBasic,
    recordCharacterSkillStyle: basicStore.recordSkillStyle,
    recordCharacterScore: basicStore.recordScore,
    readAdventureNames: (characters) => readAdventureNames(client, characters),
    adventureGuild: {
      readAdventureCharacters: (adventureName) => readAdventureCharacters(client, adventureName),
      readGuild: (guildId) => readGuild(client, guildId),
      readAdventureWeeklyClears: (adventureName) =>
        readAdventureWeeklyClears(client, adventureName, new Date()),
      readAdventureActivity: (adventureName, seasonId) =>
        readAdventureActivity(client, adventureName, seasonId, new Date()),
      readAdventureSeasonDays: (adventureName, seasonId) =>
        readAdventureSeasonDays(client, adventureName, seasonId, new Date()),
      readAdventureSeasonBackfill: (adventureName, seasonId) =>
        readAdventureSeasonBackfill(client, adventureName, seasonId, new Date())
    },
    rankingStats: {
      readFameRanking: (filter, limit) => readFameRanking(client, filter, limit),
      readCharacterStatsSnapshot: () => readCharacterStatsSnapshot(client),
      readJobSkillAdoptionSnapshot: (job) => readJobSkillAdoptionSnapshot(client, job)
    },
    clearStats: {
      readCollectedAt: () => readContentClearCollectedAt(client),
      readPopulations: () => readContentClearPopulations(client),
      readWeekRatioCounts: () => readContentClearWeekRatioCounts(client),
      readJobCounts: (selection) => readContentClearJobCounts(client, selection),
      readAdventureSizes: (selection) => readContentClearAdventureSizes(client, selection),
      readFames: (weekStart) => readContentClearFames(client, weekStart),
      readJobFames: (weekStart) => readContentClearJobFames(client, weekStart),
      readCoClears: (weekStart) => readContentClearCoClears(client, weekStart),
      readRaidTimes: (weekStart) => readContentClearRaidTimes(client, weekStart)
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

export function createApiRuntime(configuration: RuntimeConfiguration) {
  return createApiHttpApp(createApiRuntimeOptions(configuration))
}

export function createOpsRuntime(
  database: DatabaseConfiguration,
  readQueueCounts: ReadQueueCounts
) {
  const client = createDatabaseClient(database)

  return createOpsHttpApp({
    jobs: {
      readOverviews: () => readJobOverviews(client),
      readRuns: (name, page) => readJobRuns(client, name, page),
      requestRun: (name, args) => requestJobRun(client, name, args),
      setPaused: (name, paused) => setJobPaused(client, name, paused)
    },
    readQueueCounts,
    collection: {
      readSummary: () => readCollectionSummary(client),
      requeue: (failure) => requeueCollectionFailures(client, failure)
    },
    batchNeopleKeys: {
      readKeys: () => readBatchNeopleKeys(client),
      add: (input) => addBatchNeopleKey(client, input),
      setEnabled: (id, enabled) => setBatchNeopleKeyEnabled(client, id, enabled),
      delete: (id) => deleteBatchNeopleKey(client, id)
    },
    close: () => client.$disconnect()
  })
}
