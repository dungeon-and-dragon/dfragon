import { setTimeout } from 'node:timers/promises'
import type { DatabaseClient } from '@dfragon/database'
import type {
  ClearCollectionPorts,
  CreateClearTimeline
} from '../application/content-clears/ports.js'
import {
  createClearRecordBackfillJob,
  createClearWeekSampleJob,
  createContentClearCollectionJob
} from '../application/content-clears/collection-job.js'
import { ContentClearCollectionService } from '../application/content-clears/collection.js'
import { ClearRecordBackfillService } from '../application/content-clears/record-backfill.js'
import { ClearWeekSampleService } from '../application/content-clears/week-samples.js'
import { DatabaseClearStatsRepository } from '../infrastructure/database/clear-stats.js'
import {
  DatabaseClearCollectionRepository,
  DatabaseClearRecordBackfillRepository
} from '../infrastructure/database/content-clear-collection.js'
import type { SkillStyleCollectionPorts } from '../application/ranking-stats/ports.js'
import { DatabaseSkillStyleCollectionRepository } from '../infrastructure/database/skill-style-collection.js'
import {
  SkillStyleCollectionService,
  createSkillStyleCollectionJob
} from '../application/ranking-stats/skill-style-collection.js'
import {
  StatsJobService,
  createCharacterStatsJob,
  createSkillAdoptionJob
} from '../application/ranking-stats/stats-jobs.js'
import { DatabaseStatsJobRepository } from '../infrastructure/database/stats-jobs.js'
import type { JobDefinition } from '../application/jobs/definition.js'
import { DatabaseJobRunCleanupRepository } from '../infrastructure/database/job-run-cleanup.js'
import {
  JobRunCleanupService,
  createJobRunCleanupJob
} from '../application/jobs/job-run-cleanup.js'
import type { ScoreCalculationPorts } from '../application/character-score/ports.js'
import {
  SCORE_CALCULATION_JOB_NAME,
  ScoreCalculationService,
  createScoreCalculationJob
} from '../application/character-score/calculation-job.js'
import { DatabaseScoreCalculationRepository } from '../infrastructure/database/score-calculation.js'

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
