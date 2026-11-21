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
  paceNeopleRequests
} from '#infrastructure/neople/index.js'
import {
  createNeopleItemDetails,
  parseCharacterBasic,
  parseCharacterSets
} from '@dfragon/server-core/infrastructure/neople/index.js'
import type { readCollectorConfiguration } from './collector-configuration.js'
import { CharacterCollectionService } from '#application/character-collection/index.js'
import {
  DatabaseBatchNeopleKeyRepository,
  DatabaseCollectionRepository,
  DatabaseJobRepository
} from '#infrastructure/database/index.js'
import { importCollectedCharacters, readImportModifiedTime } from '#infrastructure/files/index.js'
import { JobSchedulerService } from '#application/jobs/index.js'
import { startJobScheduler } from '#infrastructure/jobs/index.js'
import { createScoreEngineOpener, createScoreSources } from './score-calculation.js'
import { createWorkerJobs } from './worker-jobs.js'
import { startWorkerEventRecorder } from './worker-events.js'

const BATCH_KEY_REFRESH_MS = 5000

function writeReport(code: string, details?: Readonly<Record<string, unknown>>): void {
  writeAccessLogToStdout(
    JSON.stringify({
      time: new Date().toISOString(),
      service: 'character-collector',
      code,
      ...details
    })
  )
}

// SIGTERM은 Node 기본 동작으로 끝낸다. 저장 전에 끝난 캐릭터는 대기열에 남아 다음 시작 때 다시 부른다.
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
  const keyPool = createBatchNeopleKeyPool({
    store: keyRepository,
    createNeople: (key) =>
      paceNeopleRequests(createNeopleClient(key), configuration.requestsPerSecond),
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

  const { neople, readConcurrency } = keyPool
  const fetchBasic = createNeopleCharacterBasic(neople)
  const openScoreEngine = createScoreEngineOpener(configuration.scoreLibraryPath, report)
  const jobs = createWorkerJobs(client, {
    createFetchTimeline: createNeopleClearTimeline(neople),
    createFetchRecordTimeline: createNeopleClearRecordTimeline(neople),
    fetchSkillStyle: createNeopleSkillStyle(neople),
    fetchItemDetails: createNeopleItemDetails(neople),
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

  return collection.run()
}
