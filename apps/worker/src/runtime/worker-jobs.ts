import { setTimeout } from 'node:timers/promises'
import type { DatabaseClient } from '@dfragon/database'
import type {
  ClearCollectionPorts,
  CreateClearTimeline
} from '../application/content-clears/ports.js'
import {
  createClearRecordBackfillJob,
  createClearWeekSampleJob,
  createContentClearCollectionJob,
  ContentClearCollectionService,
  ClearRecordBackfillService,
  ClearWeekSampleService
} from '../application/content-clears/index.js'
import { DatabaseClearStatsRepository } from '@dfragon/server-core/infrastructure/database/clear-stats.js'
import {
  DatabaseClearCollectionRepository,
  DatabaseClearRecordBackfillRepository,
  DatabaseSkillStyleCollectionRepository,
  DatabaseStatsJobRepository,
  DatabaseJobRunCleanupRepository,
  DatabaseScoreCalculationRepository
} from '../infrastructure/database/index.js'
import type { SkillStyleCollectionPorts } from '../application/ranking-stats/ports.js'
import {
  SkillStyleCollectionService,
  createSkillStyleCollectionJob,
  StatsJobService,
  createCharacterStatsJob,
  createSkillAdoptionJob
} from '../application/ranking-stats/index.js'
import {
  type JobDefinition,
  JobRunCleanupService,
  createJobRunCleanupJob
} from '../application/jobs/index.js'
import type { ScoreCalculationPorts } from '../application/character-score/ports.js'
import {
  SCORE_CALCULATION_JOB_NAME,
  ScoreCalculationService,
  createScoreCalculationJob
} from '../application/character-score/index.js'

type ClockKey = 'now' | 'pause'

export type WorkerJobDependencies = Omit<ClearCollectionPorts, ClockKey> &
  Omit<SkillStyleCollectionPorts, ClockKey> & {
    createFetchRecordTimeline: CreateClearTimeline
    score: Omit<ScoreCalculationPorts, ClockKey> & { schedule?: string }
  }

export function createWorkerJobs(
  client: DatabaseClient,
  collection: WorkerJobDependencies
): JobDefinition[] {
  const clock = { now: () => new Date(), pause: (ms: number) => setTimeout(ms) }
  const {
    createFetchTimeline,
    createFetchRecordTimeline,
    fetchSkillStyle,
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
  const statsService = new StatsJobService(new DatabaseStatsJobRepository(client))
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
    createCharacterStatsJob(statsService),
    createSkillAdoptionJob(statsService),
    createScoreCalculationJob(scoreService, scoreSchedule)
  ]
}
