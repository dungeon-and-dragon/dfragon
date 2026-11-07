import { setTimeout } from 'node:timers/promises'
import { createDatabaseClient } from '@dfragon/database'
import { createNeopleClient } from '@dfragon/neople'
import { writeAccessLogToStdout } from './access-log.js'
import {
  createDatabaseSkillStyleStore,
  createNeopleSkillStyle
} from './skill-style-collection/adapters.js'
import { readSkillStyleCollectorConfiguration } from './skill-style-collection/configuration.js'
import { runSkillStylePass } from './skill-style-collection/runner.js'

const failureMessage = 'Skill style collector failed'
const IDLE_MS = 60 * 60_000
const UNAVAILABLE_PAUSE_MS = 60_000

function report(code: string): void {
  writeAccessLogToStdout(
    JSON.stringify({ time: new Date().toISOString(), service: 'skill-style-collector', code })
  )
}

// SIGTERM은 Node 기본 동작으로 끝낸다. 저장 전에 끝난 캐릭터는 갱신 시각이 그대로라 다음 시작 때 다시 고른다.
async function main(): Promise<never> {
  const configuration = readSkillStyleCollectorConfiguration(process.env)
  const client = createDatabaseClient(configuration.database)
  const fetchSkillStyle = createNeopleSkillStyle(createNeopleClient(configuration.apiKey))
  const store = createDatabaseSkillStyleStore(client)
  for (;;) {
    const outcome = await runSkillStylePass({
      fetchSkillStyle,
      store,
      requestIntervalMs: 1000 / configuration.requestsPerSecond,
      concurrency: configuration.concurrency,
      report
    })
    await setTimeout(outcome === 'unavailable' ? UNAVAILABLE_PAUSE_MS : IDLE_MS)
  }
}

try {
  await main()
} catch {
  console.error(failureMessage)
  process.exitCode = 1
}
