import {
  type DatabaseConfiguration,
  createDatabaseClient,
  readAdventureCharacters,
  readAdventureNames,
  readCharacterStats,
  readContentClearAdventureSizes,
  readContentClearCollectedAt,
  readContentClearJobCounts,
  readContentClearPopulations,
  readContentClearWeekRatioCounts,
  readFameRanking,
  readGuild,
  readCollectionSummary,
  readJobOverviews,
  readJobRuns,
  readJobSkillAdoption,
  recordCharacterBasic,
  recordCharacterSkillStyle,
  requestJobRun,
  requeueCollectionFailures,
  setJobPaused
} from '@dfragon/database'
import { type NeopleClient, createNeopleClient } from '@dfragon/neople'
import { createCatalogService } from '../characters/catalog/service.js'
import { createNeopleCatalog } from '../characters/catalog/neople.js'
import { createNeopleCharacterSearch } from '../characters/neople-character-search.js'
import { createNeopleCharacterDetails } from '../characters/details/neople.js'
import { createNeopleCharacterTimeline } from '../characters/timeline/neople.js'
import { backfillEnhancements } from '../characters/timeline/backfill.js'
import {
  createDatabaseEnhancementBackfillStore,
  createDatabaseSeasonBackfillStore,
  createDatabaseTimelineStore
} from '../characters/timeline/store.js'
import { backfillSeason } from '../characters/timeline/season-backfill.js'
import {
  ENHANCEMENT_CODES,
  readCharacterTimeline,
  readTimelinePage
} from '../characters/timeline/read.js'
import { syncCharacterTimeline } from '../characters/timeline/sync.js'
import { createNeopleShopGrade } from '../today-grade/neople.js'
import {
  readAdventureActivity,
  readAdventureSeasonDays,
  readAdventureSeasonBackfill
} from '../adventure-guild/activity.js'
import { readAdventureWeeklyClears } from '../adventure-guild/weekly.js'
import { type ApiHttpAppOptions, createApiHttpApp } from '../http.js'
import type { CharacterSearchDependencies } from '../characters/types.js'
import { createOpsHttpApp } from '../ops/app.js'
import type { ReadQueueCounts } from '../ops/queues.js'
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
  | 'adventureGuild'
  | 'rankingStats'
  | 'clearStats'
> &
  Pick<CharacterSearchDependencies, 'readAdventureNames'> {
  if (database === undefined) {
    return {}
  }
  const client = createDatabaseClient(database)
  const fetchTimeline = createNeopleCharacterTimeline(neople)
  const store = createDatabaseTimelineStore(client)
  const backfill = {
    fetchTimeline: createNeopleCharacterTimeline(neople, ENHANCEMENT_CODES),
    store: createDatabaseEnhancementBackfillStore(client)
  }
  const seasonBackfill = { fetchTimeline, store: createDatabaseSeasonBackfillStore(client) }

  // 두 구독자가 client 하나를 함께 쓰며, 타임라인 구독자가 종료 때 닫는다.

  return {
    timeline: {
      sync: (character) => syncCharacterTimeline(character, { fetchTimeline, store }),
      backfillEnhancements: (character) => backfillEnhancements(character, backfill),
      backfillSeason: (job) => backfillSeason(job, seasonBackfill),
      read: (character) => readCharacterTimeline(client, character, new Date()),
      readPage: (character, list, before) => readTimelinePage(client, character, list, before),
      close: () => client.$disconnect()
    },
    recordCharacterBasic: (basic) => recordCharacterBasic(client, basic),
    recordCharacterSkillStyle: (style) => recordCharacterSkillStyle(client, style),
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
      readCharacterStats: () => readCharacterStats(client),
      readJobSkillAdoption: (job) => readJobSkillAdoption(client, job)
    },
    clearStats: {
      readCollectedAt: () => readContentClearCollectedAt(client),
      readPopulations: () => readContentClearPopulations(client),
      readWeekRatioCounts: () => readContentClearWeekRatioCounts(client),
      readJobCounts: (selection) => readContentClearJobCounts(client, selection),
      readAdventureSizes: (selection) => readContentClearAdventureSizes(client, selection)
    }
  }
}

export function createApiRuntime(configuration: RuntimeConfiguration) {
  const neople = createNeopleClient(configuration.apiKey)
  const { readAdventureNames: readCandidateAdventureNames, ...database } =
    createDatabaseSubscribers(neople, configuration.database)

  return createApiHttpApp({
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
    trustedProxyHops: configuration.trustedProxyHops,
    httpsOptions: configuration.localHttps,
    scoreLibraryPath: configuration.scoreLibraryPath
  })
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
    close: () => client.$disconnect()
  })
}
