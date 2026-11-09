import { setTimeout } from 'node:timers/promises'
import { createDatabaseClient } from '@dfragon/database'
import { createNeopleClient } from '@dfragon/neople'
import { writeAccessLogToStdout } from './access-log.js'
import {
  createDatabaseCollectionStore,
  createDatabaseEnqueue,
  createNeopleCharacterBasic,
  paceNeopleRequests
} from './character-collection/adapters.js'
import { readCollectorConfiguration } from './character-collection/configuration.js'
import { runCollectionPass } from './character-collection/runner.js'
import { createDatabaseJobStore } from './jobs/adapters.js'
import { createDiscordJobAlert } from './jobs/alert.js'
import { startJobScheduler } from './jobs/scheduler.js'
import { createWorkerJobs } from './jobs/worker-jobs.js'

const failureMessage = 'Character collector failed'
const IDLE_MS = 60_000
const UNAVAILABLE_PAUSE_MS = 60_000

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
async function main(): Promise<never> {
  const configuration = readCollectorConfiguration(process.env)
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
      neople,
      concurrency: configuration.concurrency,
      report
    }),
    store: createDatabaseJobStore(client),
    report,
    alert
  })
  let importedAt: ReadonlyMap<string, number> = new Map()
  for (;;) {
    const pass = await runCollectionPass({
      importFiles: configuration.importFiles,
      importedAt,
      enqueue,
      fetchBasic,
      store,
      concurrency: configuration.concurrency,
      report
    })
    importedAt = pass.importedAt
    await setTimeout(pass.outcome === 'unavailable' ? UNAVAILABLE_PAUSE_MS : IDLE_MS)
  }
}

try {
  await main()
} catch {
  console.error(failureMessage)
  process.exitCode = 1
}
