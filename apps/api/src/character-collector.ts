import { createDatabaseClient } from '@dfragon/database'
import { createNeopleClient } from '@dfragon/neople'
import { writeAccessLogToStdout } from './access-log.js'
import {
  createDatabaseCollectionStore,
  createDatabaseEnqueue,
  createNeopleCharacterBasic
} from './character-collection/adapters.js'
import { readCollectorConfiguration } from './character-collection/configuration.js'
import { runCharacterCollector } from './character-collection/runner.js'

const failureMessage = 'Character collector failed'
const IDLE_MS = 60_000
const UNAVAILABLE_PAUSE_MS = 60_000

function report(code: string, details?: Record<string, number>): void {
  writeAccessLogToStdout(
    JSON.stringify({
      time: new Date().toISOString(),
      service: 'character-collector',
      code,
      ...details
    })
  )
}

async function main(): Promise<void> {
  const configuration = readCollectorConfiguration(process.env)
  const client = createDatabaseClient(configuration.database)
  const stop = new AbortController()
  const shutdown = (): void => stop.abort()
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
  try {
    await runCharacterCollector({
      importFile: configuration.importFile,
      enqueue: createDatabaseEnqueue(client),
      fetchBasic: createNeopleCharacterBasic(createNeopleClient(configuration.apiKey)),
      store: createDatabaseCollectionStore(client),
      timing: {
        requestIntervalMs: 1000 / configuration.requestsPerSecond,
        idleMs: IDLE_MS,
        unavailablePauseMs: UNAVAILABLE_PAUSE_MS
      },
      report,
      signal: stop.signal
    })
  } finally {
    await client.$disconnect()
  }
}

try {
  await main()
} catch {
  console.error(failureMessage)
  process.exitCode = 1
}
