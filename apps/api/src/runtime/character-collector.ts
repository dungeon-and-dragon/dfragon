import { setTimeout } from 'node:timers/promises'
import { createDatabaseClient } from '@dfragon/database'
import { createNeopleClient } from '@dfragon/neople'
import { createNeopleClearTimeline } from '../infrastructure/neople/content-clear-collection.js'
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
  const neople = paceNeopleRequests(
    createNeopleClient(configuration.apiKey),
    configuration.requestsPerSecond
  )
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
      fetchSkillStyle: createNeopleSkillStyle(neople),
      concurrency: configuration.concurrency,
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
    concurrency: configuration.concurrency,
    report,
    readModifiedTime: readImportModifiedTime,
    importCharacters: importCollectedCharacters,
    pause: setTimeout
  })
}
