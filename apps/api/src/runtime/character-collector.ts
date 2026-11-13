import { setTimeout } from 'node:timers/promises'
import {
  createDatabaseClient,
  readUsableBatchNeopleKeys,
  recordBatchNeopleKeyRejected
} from '@dfragon/database'
import { createNeopleClient } from '@dfragon/neople'
import { createBatchNeopleKeyPool } from '../infrastructure/neople/batch-key-pool.js'
import {
  createNeopleClearRecordTimeline,
  createNeopleClearTimeline
} from '../infrastructure/neople/content-clear-collection.js'
import { createNeopleSkillStyle } from '../infrastructure/neople/skill-style-collection.js'
import { writeAccessLogToStdout } from '../presentation/http/access-log-sink.js'
import {
  createNeopleCharacterBasic,
  paceNeopleRequests
} from '../infrastructure/neople/character-collection.js'
import type { readCollectorConfiguration } from './collector-configuration.js'
import { runCharacterCollector } from '../application/character-collection/runner.js'
import {
  createDatabaseCollectionStore,
  createDatabaseEnqueue
} from '../infrastructure/database/character-collection.js'
import {
  importCollectedCharacters,
  readImportModifiedTime
} from '../infrastructure/files/character-collection.js'
import { createDatabaseJobStore } from '../infrastructure/database/jobs.js'
import { createDiscordJobAlert } from '../infrastructure/jobs/alert.js'
import { startJobScheduler } from '../infrastructure/jobs/scheduler.js'
import { createWorkerJobs } from './worker-jobs.js'

const BATCH_KEY_REFRESH_MS = 5000

function report(code: string, details?: Readonly<Record<string, unknown>>): void {
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
  const keyPool = createBatchNeopleKeyPool({
    store: {
      readUsableKeys: () => readUsableBatchNeopleKeys(client),
      recordRejected: (id) => recordBatchNeopleKeyRejected(client, id)
    },
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
  }, BATCH_KEY_REFRESH_MS)

  const { neople, readConcurrency } = keyPool
  const fetchBasic = createNeopleCharacterBasic(neople)
  const store = createDatabaseCollectionStore(client)
  const enqueue = createDatabaseEnqueue(client)
  const alert =
    configuration.jobAlertWebhookUrl !== undefined
      ? createDiscordJobAlert(configuration.jobAlertWebhookUrl)
      : undefined
  await startJobScheduler({
    jobs: createWorkerJobs(client, {
      createFetchTimeline: createNeopleClearTimeline(neople),
      createFetchRecordTimeline: createNeopleClearRecordTimeline(neople),
      fetchSkillStyle: createNeopleSkillStyle(neople),
      readConcurrency,
      report
    }),
    store: createDatabaseJobStore(client),
    report,
    alert
  })

  return runCharacterCollector({
    importFiles: configuration.importFiles,
    enqueue,
    fetchBasic,
    store,
    readConcurrency,
    report,
    readModifiedTime: readImportModifiedTime,
    importCharacters: importCollectedCharacters,
    pause: setTimeout
  })
}
