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
import { latestRefreshStart, msUntilNextRefresh } from './skill-style-collection/schedule.js'

const failureMessage = 'Skill style collector failed'
const UNAVAILABLE_PAUSE_MS = 60_000

function report(code: string): void {
  writeAccessLogToStdout(
    JSON.stringify({ time: new Date().toISOString(), service: 'skill-style-collector', code })
  )
}

// SIGTERM은 Node 기본 동작으로 끝낸다. 회차 시작 전에 받은 캐릭터만 고르므로, 다시 시작하면 끊긴 회차를 남은 캐릭터부터 잇는다.
async function main(): Promise<never> {
  const configuration = readSkillStyleCollectorConfiguration(process.env)
  const client = createDatabaseClient(configuration.database)
  const fetchSkillStyle = createNeopleSkillStyle(createNeopleClient(configuration.apiKey))
  const store = createDatabaseSkillStyleStore(client)
  for (;;) {
    const outcome = await runSkillStylePass({
      fetchSkillStyle,
      store,
      startedAt: latestRefreshStart(new Date()),
      concurrency: configuration.concurrency,
      report
    })
    await setTimeout(
      outcome === 'unavailable' ? UNAVAILABLE_PAUSE_MS : msUntilNextRefresh(new Date())
    )
  }
}

try {
  await main()
} catch {
  console.error(failureMessage)
  process.exitCode = 1
}
