import assert from 'node:assert/strict'
import test from 'node:test'
import type {
  ClearContentWeek,
  ClearContentWeekSamples,
  StoredClearPopulation
} from '@dfragon/database'
import { emptyClearStatsRepository } from '../src/application/content-clears/service.js'
import { ClearWeekSampleService } from '../src/application/content-clears/week-samples.js'
import { formatResetDate } from '../src/domain/seoul-time.js'

// 합성 모집단과 집계다. DB 읽기와 저장은 fake이며 저장한 재료를 다시 읽는 왕복은 container-content-clear-check.mjs가 확인한다.
const week = (date: string) => new Date(`${date}T06:00:00+09:00`)
const population = (contentId: string, date: string, closed: boolean): StoredClearPopulation => ({
  contentId,
  weekStart: week(date),
  population: 1000,
  minFame: 126000,
  jobs: [],
  collectedAt: week('2026-11-13'),
  closed
})

test('마감한 주 집계는 저장하지 않은 마감한 주를 최근 주부터 저장하고, 전체 개요는 그 주의 모든 모집단이 마감했을 때만 저장한다', async () => {
  const recordedContents: string[] = []
  const recordedSamples = new Map<string, ClearContentWeekSamples>()
  const recordedOverviews: string[] = []
  const keyOf = ({ contentId, weekStart }: ClearContentWeek) =>
    `${contentId}/${formatResetDate(weekStart)}`
  const service = new ClearWeekSampleService({
    ...emptyClearStatsRepository,
    readPopulations: async () => [
      population('michaela-hard', '2026-10-29', true),
      population('michaela-hard', '2026-11-05', true),
      population('engraved-nightmare-1', '2026-11-05', true),
      population('michaela-hard', '2026-11-12', true),
      population('engraved-nightmare-1', '2026-11-12', false),
      population('retired-raid', '2026-11-05', true)
    ],
    readContentWeekSampleWeeks: async () => [
      { contentId: 'michaela-hard', weekStart: week('2026-10-29') }
    ],
    readOverviewSampleWeeks: async () => [week('2026-10-29')],
    readContentJobFames: async ({ contentId, weekStart }) => [
      {
        contentId,
        jobId: null,
        jobGrowId: null,
        jobName: null,
        jobGrowName: null,
        cleared: weekStart.getDate(),
        characters: 0,
        quantiles: null,
        max: null
      }
    ],
    recordContentWeekSamples: async (contentWeek, samples) => {
      recordedContents.push(keyOf(contentWeek))
      recordedSamples.set(keyOf(contentWeek), samples)
    },
    recordOverviewSamples: async (weekStart) => {
      recordedOverviews.push(formatResetDate(weekStart))
    }
  })

  const summary = await service.recordMissing(() => undefined)

  assert.deepEqual(summary, { contents: 3, overviews: 1 })
  assert.equal(recordedContents[0], 'michaela-hard/2026-11-12')
  assert.deepEqual(recordedContents.slice(1).toSorted(), [
    'engraved-nightmare-1/2026-11-05',
    'michaela-hard/2026-11-05'
  ])
  assert.deepEqual(recordedOverviews, ['2026-11-05'])
  assert.equal(
    recordedSamples.get('michaela-hard/2026-11-05')?.jobFames[0]?.cleared,
    week('2026-11-05').getDate()
  )
  assert.equal(recordedSamples.get('engraved-nightmare-1/2026-11-05')?.streaks, null)
})
