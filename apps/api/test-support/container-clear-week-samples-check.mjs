import assert from 'node:assert/strict'
import {
  createDatabaseClient,
  readContentClearOverviewSampleWeeks,
  readContentClearWeekSampleWeeks,
  readDatabaseConfiguration,
  recordContentClearPopulation
} from '@dfragon/database'
import { DatabaseClearStatsRepository } from '@dfragon/server-core/infrastructure/database/index.js'
import { ClearWeekSampleService } from './dist/application/content-clears/week-samples.js'

// 앞 단계의 API 검사가 넣은 합성 클리어 기록에 마감하지 않은 주의 분모만 더한다. 레기온은 앞 단계가 옮기지 않은
// 마감한 주를 이 job이 옮긴다.
const at = (time) => new Date(`${time}+09:00`)
const closedWeek = at('2026-11-05T06:00:00').getTime()
const openWeek = at('2026-11-19T06:00:00')
const openWeekTime = openWeek.getTime()
const openWeekCollectedAt = at('2026-11-20T06:00:00')

const client = createDatabaseClient(readDatabaseConfiguration(process.env))
try {
  await recordContentClearPopulation(client, {
    contentId: 'engraved-nightmare-1',
    weekStart: openWeek,
    population: 1000,
    minFame: 126000,
    jobs: [
      {
        jobId: 'synthetic-clear-job',
        jobGrowId: 'synthetic-clear-grow',
        jobName: '합성직업',
        jobGrowName: '眞 합성전직',
        count: 1000
      }
    ],
    collectedAt: openWeekCollectedAt,
    closed: false
  })

  const service = new ClearWeekSampleService(new DatabaseClearStatsRepository(client), () =>
    at('2026-11-10T07:00:00')
  )

  const recorded = await service.recordMissing(() => undefined)
  assert.ok(recorded.legions > 0 && recorded.contents > 0 && recorded.overviews > 0)
  assert.deepEqual(await service.recordMissing(() => undefined), {
    legions: 0,
    contents: 0,
    overviews: 0
  })
  const overviewSampleWeeks = (await readContentClearOverviewSampleWeeks(client)).map((weekStart) =>
    weekStart.getTime()
  )

  assert.ok(overviewSampleWeeks.includes(closedWeek))
  // 마감하지 않은 주는 컨텐츠 재료와 전체 개요 모두 저장하지 않는다.
  assert.ok(!overviewSampleWeeks.includes(openWeekTime))
  assert.ok(
    (await readContentClearWeekSampleWeeks(client)).every(
      ({ weekStart }) => weekStart.getTime() !== openWeekTime
    )
  )
} finally {
  await client.$disconnect()
}
