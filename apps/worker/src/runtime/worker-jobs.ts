import { setTimeout } from 'node:timers/promises'
import type { DatabaseClient } from '@dfragon/database'
import type {
  ClearCollectionPorts,
  CreateClearTimeline
} from '#application/content-clears/ports.js'
import {
  createClearRecordBackfillJob,
  createClearWeekSampleJob,
  createContentClearCollectionJob,
  ContentClearCollectionService,
  ClearRecordBackfillService,
  ClearWeekSampleService
} from '#application/content-clears/index.js'
import {
  DatabaseAuctionPriceRepository,
  DatabaseClearStatsRepository,
  DatabaseItemDictionaryRepository
} from '@dfragon/server-core/infrastructure/database/index.js'
import { AuctionPriceService } from '@dfragon/server-core/application/auction-prices/index.js'
import type {
  FetchLowestLevelListing,
  FetchLowestListing,
  FindItem
} from '@dfragon/server-core/application/auction-prices/ports.js'
import { ItemDictionaryService } from '@dfragon/server-core/application/item-dictionary/index.js'
import { parseCharacterSkillStyle } from '@dfragon/server-core/infrastructure/neople/index.js'
import type { FetchItemDetails } from '@dfragon/server-core/application/item-dictionary/ports.js'
import { createItemDictionaryFillJob } from '#application/item-dictionary/index.js'
import {
  createAuctionPriceJob,
  createLabCandidatePriceJob
} from '#application/auction-prices/index.js'
import {
  DatabaseAcquisitionItemRepository,
  DatabaseCharacterActivityRepository,
  DatabaseClearCollectionRepository,
  DatabaseClearRecordBackfillRepository,
  DatabaseCollectionRepository,
  DatabaseSkillChainBackfillRepository,
  DatabaseSkillStyleCollectionRepository,
  DatabaseStatsJobRepository,
  DatabaseJobRunCleanupRepository,
  DatabaseLabCandidatePriceRepository,
  DatabaseLabItemRepository,
  DatabaseScoreCalculationRepository
} from '#infrastructure/database/index.js'
import type { SkillStyleCollectionPorts } from '#application/ranking-stats/ports.js'
import {
  SkillChainBackfillService,
  SkillStyleCollectionService,
  createSkillChainBackfillJob,
  createSkillStyleCollectionJob,
  StatsJobService,
  createCharacterStatsJob,
  createItemAdoptionJob,
  createSetAdoptionJob,
  createSkillAdoptionJob
} from '#application/ranking-stats/index.js'
import {
  type JobDefinition,
  JobRunCleanupService,
  createJobRunCleanupJob
} from '#application/jobs/index.js'
import type { ScoreCalculationPorts } from '#application/character-score/ports.js'
import type { CharacterActivityPorts } from '#application/character-activity/ports.js'
import {
  CharacterActivityService,
  createFameRefreshJob,
  createInactiveRecheckJob
} from '#application/character-activity/index.js'
import type { CharacterDiscoveryPorts } from '#application/character-collection/ports.js'
import {
  CharacterDiscoveryService,
  createCharacterDiscoveryJob
} from '#application/character-collection/index.js'
import {
  SCORE_CALCULATION_JOB_NAME,
  ScoreCalculationService,
  createScoreCalculationJob
} from '#application/character-score/index.js'

type ClockKey = 'now' | 'pause'

export type WorkerJobDependencies = Omit<ClearCollectionPorts, ClockKey> &
  Omit<SkillStyleCollectionPorts, ClockKey> &
  Omit<CharacterDiscoveryPorts, ClockKey> &
  Omit<CharacterActivityPorts, ClockKey> & {
    createFetchRecordTimeline: CreateClearTimeline
    fetchItemDetails: FetchItemDetails
    fetchLowestListing: FetchLowestListing
    fetchLowestLevelListing: FetchLowestLevelListing
    findItem: FindItem
    score: Omit<ScoreCalculationPorts, ClockKey> & { schedule?: string }
  }

export function createWorkerJobs(
  client: DatabaseClient,
  activityClient: DatabaseClient,
  collection: WorkerJobDependencies
): JobDefinition[] {
  const clock = { now: () => new Date(), pause: (ms: number) => setTimeout(ms) }
  const {
    createFetchTimeline,
    createFetchRecordTimeline,
    fetchSkillStyle,
    fetchItemDetails,
    fetchLowestListing,
    fetchLowestLevelListing,
    findItem,
    readTargets,
    readTopFame,
    fetchFamePage,
    fetchLatestActivity,
    fetchBasic,
    readConcurrency,
    report
  } = collection
  const { schedule: scoreSchedule, ...score } = collection.score

  const cleanupService = new JobRunCleanupService(new DatabaseJobRunCleanupRepository(client))
  const clearCollectionService = new ContentClearCollectionService(
    new DatabaseClearCollectionRepository(client),
    { createFetchTimeline, readConcurrency, report, ...clock }
  )
  const recordBackfillService = new ClearRecordBackfillService(
    new DatabaseClearRecordBackfillRepository(client),
    { createFetchTimeline: createFetchRecordTimeline, readConcurrency, report, ...clock }
  )
  const weekSampleService = new ClearWeekSampleService(
    new DatabaseClearStatsRepository(client),
    clock.now
  )
  const skillStyleService = new SkillStyleCollectionService(
    new DatabaseSkillStyleCollectionRepository(client),
    { fetchSkillStyle, readConcurrency, report, ...clock }
  )
  const skillChainService = new SkillChainBackfillService(
    new DatabaseSkillChainBackfillRepository(client),
    parseCharacterSkillStyle
  )
  const discoveryService = new CharacterDiscoveryService(new DatabaseCollectionRepository(client), {
    readTargets,
    readTopFame,
    fetchFamePage,
    readConcurrency,
    report,
    pause: clock.pause
  })
  const activityService = new CharacterActivityService(
    new DatabaseCharacterActivityRepository(activityClient),
    { fetchLatestActivity, fetchBasic, readConcurrency, report, ...clock }
  )
  const statsService = new StatsJobService(new DatabaseStatsJobRepository(client))
  const itemDictionary = new ItemDictionaryService(
    new DatabaseItemDictionaryRepository(client),
    fetchItemDetails
  )
  const auctionPrices = new AuctionPriceService(
    new DatabaseAuctionPriceRepository(client),
    fetchLowestListing,
    fetchLowestLevelListing,
    findItem
  )
  const scoreService = new ScoreCalculationService(
    new DatabaseScoreCalculationRepository(client, SCORE_CALCULATION_JOB_NAME),
    { ...score, ...clock }
  )

  return [
    createJobRunCleanupJob(cleanupService),
    createContentClearCollectionJob(clearCollectionService),
    createClearRecordBackfillJob(recordBackfillService),
    createClearWeekSampleJob(weekSampleService),
    createSkillStyleCollectionJob(skillStyleService),
    createSkillChainBackfillJob(skillChainService),
    createCharacterDiscoveryJob(discoveryService),
    createFameRefreshJob(activityService),
    createInactiveRecheckJob(activityService),
    createCharacterStatsJob(statsService),
    createSkillAdoptionJob(statsService),
    createSetAdoptionJob(statsService),
    createItemAdoptionJob(statsService),
    createScoreCalculationJob(scoreService, scoreSchedule),
    createItemDictionaryFillJob(new DatabaseAcquisitionItemRepository(client), itemDictionary),
    createAuctionPriceJob(new DatabaseLabItemRepository(client), auctionPrices),
    createLabCandidatePriceJob(new DatabaseLabCandidatePriceRepository(client), auctionPrices)
  ]
}
