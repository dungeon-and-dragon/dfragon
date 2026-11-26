import { setTimeout } from 'node:timers/promises'
import { createDatabaseClient, recordWorkerEvents } from '@dfragon/database'
import { writeAccessLogToStdout } from '@dfragon/http-server'
import { createNeopleClient } from '@dfragon/neople'
import {
  createBatchNeopleKeyPool,
  createNeopleClearRecordTimeline,
  createNeopleClearTimeline,
  createNeopleSkillStyle,
  createNeopleFameSearch,
  createNeopleCharacterBasic,
  createNeopleLatestActivity,
  pacePrioritizedNeopleRequests
} from '#infrastructure/neople/index.js'
import {
  createNeopleItemDetails,
  createNeopleItemSearch,
  createNeopleLowestListing,
  parseCharacterBasic,
  parseCharacterSets
} from '@dfragon/server-core/infrastructure/neople/index.js'
import type { readCollectorConfiguration } from './collector-configuration.js'
import { CharacterCollectionService } from '#application/character-collection/index.js'
import {
  CHARACTER_ACTIVITY_POOL,
  DatabaseBatchNeopleKeyRepository,
  DatabaseCollectionRepository,
  DatabaseJobRepository
} from '#infrastructure/database/index.js'
import { importCollectedCharacters, readImportModifiedTime } from '#infrastructure/files/index.js'
import { JobSchedulerService } from '#application/jobs/index.js'
import { startJobScheduler } from '#infrastructure/jobs/index.js'
import { createScoreEngineOpener, createScoreSources } from './score-calculation.js'
import { createTimelineSyncRequests } from './timeline-sync.js'
import { createWorkerJobs } from './worker-jobs.js'
import { startWorkerEventRecorder } from './worker-events.js'

const BATCH_KEY_REFRESH_MS = 5000
// Neople 공지(2026-03-05)의 애플리케이션 기준 허용량이다. IP 기준 분당 5만 건은 worker 전체 상한(설정)으로 지킨다.
const KEY_REQUESTS_PER_SECOND = 500

export function writeReport(code: string, details?: Readonly<Record<string, unknown>>): void {
  writeAccessLogToStdout(
    JSON.stringify({
      time: new Date().toISOString(),
      service: 'character-collector',
      code,
      ...details
    })
  )
}

// SIGTERM은 Node 기본 동작으로 끝낸다. 저장 전에 끝난 캐릭터와 타임라인 동기화 요청은 대기열에 남아 다음 시작 때 다시 부른다.
export async function startCharacterCollector(
  configuration: ReturnType<typeof readCollectorConfiguration>
): Promise<never> {
  const client = createDatabaseClient(configuration.database)
  const events = startWorkerEventRecorder({
    recordEvents: (batch) => recordWorkerEvents(client, batch),
    onFailure: () => {
      writeReport('WORKER_EVENT_RECORD_FAILED')
    }
  })

  const report = (code: string, details?: Readonly<Record<string, unknown>>) => {
    writeReport(code, details)
    events.record(code, details)
  }

  const keyRepository = new DatabaseBatchNeopleKeyRepository(client)
  const keyRequestsPerSecond = Math.min(KEY_REQUESTS_PER_SECOND, configuration.requestsPerSecond)
  const keyPool = createBatchNeopleKeyPool({
    store: keyRepository,
    createNeople: (key) => {
      const keyClient = createNeopleClient(key)

      return pacePrioritizedNeopleRequests(
        { neople: keyClient, priorityNeople: keyClient },
        keyRequestsPerSecond
      )
    },
    concurrencyPerKey: configuration.concurrency,
    report
  })

  await keyPool.refresh()
  setInterval(() => {
    keyPool.refresh().catch(() => {
      report('BATCH_NEOPLE_KEY_READ_FAILED')
    })

    const failures = keyPool.drainFailures()
    if (failures !== '') {
      report('BATCH_NEOPLE_REQUEST_FAILURES', { reasons: failures })
    }
  }, BATCH_KEY_REFRESH_MS)

  const { readConcurrency } = keyPool
  const { neople, priorityNeople } = pacePrioritizedNeopleRequests(
    keyPool,
    configuration.requestsPerSecond
  )
  const fetchBasic = createNeopleCharacterBasic(neople)
  const openScoreEngine = createScoreEngineOpener(configuration.scoreLibraryPath, report)
  const activityClient = createDatabaseClient(configuration.database, CHARACTER_ACTIVITY_POOL)
  const jobs = createWorkerJobs(client, activityClient, {
    createFetchTimeline: createNeopleClearTimeline(neople),
    createFetchRecordTimeline: createNeopleClearRecordTimeline(neople),
    fetchSkillStyle: createNeopleSkillStyle(neople),
    fetchItemDetails: createNeopleItemDetails(neople),
    fetchLowestListing: createNeopleLowestListing(neople),
    findItem: createNeopleItemSearch(neople),
    ...createNeopleFameSearch(neople),
    fetchLatestActivity: createNeopleLatestActivity(neople),
    fetchBasic,
    readConcurrency,
    report,
    score: {
      openEngine: openScoreEngine,
      createSources: (onRequest) => createScoreSources(neople, onRequest),
      readConcurrency,
      parseBasic: parseCharacterBasic,
      parseSets: parseCharacterSets,
      report,
      schedule: configuration.scoreCalculationSchedule
    }
  })
  const scheduler = new JobSchedulerService(new DatabaseJobRepository(client), {
    jobs,
    report
  })
  await startJobScheduler(scheduler, report)

  const collection = new CharacterCollectionService(new DatabaseCollectionRepository(client), {
    importFiles: configuration.importFiles,
    fetchBasic,
    readConcurrency,
    report,
    readModifiedTime: readImportModifiedTime,
    importCharacters: importCollectedCharacters,
    pause: setTimeout
  })

  const timelineSyncRequests = createTimelineSyncRequests(
    configuration.database,
    client,
    priorityNeople,
    report
  )

  return Promise.race([collection.run(), timelineSyncRequests.run()])
}
