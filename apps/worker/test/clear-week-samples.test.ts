import assert from 'node:assert/strict'
import test from 'node:test'
import type {
  ClearContentWeek,
  ClearContentWeekSamples,
  ClearWeekSelection,
  ContentClearPopulationInput,
  LegionClearWeek,
  StoredClearPopulation
} from '@dfragon/database'
import type { ClearSampleRepository } from '@dfragon/server-core/application/content-clears/repository.js'
import { ClearWeekSampleService } from '../src/application/content-clears/week-samples.js'
import { formatResetDate } from '@dfragon/server-core/domain/seoul-time.js'

// 합성 분모와 집계다. DB 읽기와 저장은 fake이며 저장한 재료를 다시 읽는 왕복은 container-content-clear-check.mjs가 확인한다.
const week = (date: string) => new Date(`${date}T06:00:00+09:00`)
const emptySampleRepository: ClearSampleRepository = {
  readAdventureSizes: async () => [],
  readContentJobFames: async () => [],
  readContentTimes: async () => [],
  readFameBands: async () => [],
  readWeekGroups: async () => [],
  readStageMoves: async () => [],
  readStreaks: async () => [],
  readRaidModes: async () => [],
  readRaidStageCounts: async () => [],
  readContentJobScores: async () => [],
  readWeekGroupScores: async () => [],
  readScoreBands: async () => [],
  readScores: async () => [],
  readJobScores: async () => [],
  readFames: async () => [],
  readJobFames: async () => [],
  readRaidTimes: async () => []
}
const population = (contentId: string, date: string, closed: boolean): StoredClearPopulation => ({
  contentId,
  weekStart: week(date),
  population: 1000,
  minFame: 126000,
  jobs: [],
  collectedAt: week('2026-11-13'),
  closed
})

test('마감한 주 집계는 저장하지 않은 마감한 주를 최근 주부터 저장하고, 전체 개요는 그 주의 모든 분모가 마감했을 때만 저장한다', async () => {
  const recordedContents: string[] = []
  const recordedSamples = new Map<string, ClearContentWeekSamples>()
  const recordedOverviews: string[] = []
  const keyOf = ({ contentId, weekStart }: ClearContentWeek) =>
    `${contentId}/${formatResetDate(weekStart)}`
  const service = new ClearWeekSampleService({
    ...emptySampleRepository,
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
    recordLegionClears: async () => undefined,
    recordPopulation: async () => undefined,
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

  // 마감한 주 10-29, 11-05, 11-12는 아포칼립스와 베누스 모두 출시 뒤라 레기온 2개씩 옮긴다.
  assert.deepEqual(summary, { legions: 6, contents: 3, overviews: 1 })
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

test('레기온은 출시 뒤 레이드 분모가 마감한 주 가운데 아직 옮기지 않은 주만 옮기고, 막 마감한 주만 명성과 점수를 복사하게 표시하며, 분모는 그 주 가장 큰 레이드 분모를 복사한 뒤 상세 집계를 계산한다', async () => {
  const largest: StoredClearPopulation = {
    ...population('nabel-normal', '2026-11-05', true),
    population: 1500,
    minFame: 104292,
    jobs: [
      {
        jobId: 'synthetic-job',
        jobGrowId: 'synthetic-grow',
        jobName: '합성직업',
        jobGrowName: '합성전직',
        count: 1500
      }
    ]
  }
  const populations: StoredClearPopulation[] = [
    population('michaela-hard', '2026-04-16', true),
    population('michaela-hard', '2026-10-29', true),
    population('michaela-hard', '2026-11-05', true),
    largest,
    population('michaela-hard', '2026-11-12', false),
    population('legion-venus', '2026-04-16', true)
  ]
  const moved: string[] = []
  const recorded: ContentClearPopulationInput[] = []
  const sampled: ClearWeekSelection[] = []
  const service = new ClearWeekSampleService(
    {
      ...emptySampleRepository,
      readPopulations: async () => populations,
      readContentWeekSampleWeeks: async () => [
        { contentId: 'michaela-hard', weekStart: week('2026-04-16') },
        { contentId: 'michaela-hard', weekStart: week('2026-10-29') },
        { contentId: 'michaela-hard', weekStart: week('2026-11-05') },
        { contentId: 'nabel-normal', weekStart: week('2026-11-05') },
        { contentId: 'legion-venus', weekStart: week('2026-04-16') }
      ],
      readOverviewSampleWeeks: async () => [
        week('2026-04-16'),
        week('2026-10-29'),
        week('2026-11-05')
      ],
      recordLegionClears: async ({ contentId, name, weekStart, copySnapshot }: LegionClearWeek) => {
        moved.push(`${contentId}/${name}/${formatResetDate(weekStart)}/${copySnapshot}`)
      },
      recordPopulation: async (input) => {
        recorded.push(input)
        populations.push({ ...input, jobs: [...input.jobs] })
      },
      readContentJobFames: async (selection) => {
        sampled.push(selection)

        return []
      },
      recordContentWeekSamples: async () => undefined,
      recordOverviewSamples: async () => undefined
    },
    () => week('2026-11-13')
  )

  const summary = await service.recordMissing(() => undefined)

  assert.deepEqual(moved.toSorted(), [
    'legion-apocalypse/아포칼립스/2026-10-29/false',
    'legion-apocalypse/아포칼립스/2026-11-05/true',
    'legion-venus/베누스/2026-10-29/false',
    'legion-venus/베누스/2026-11-05/true'
  ])
  assert.deepEqual(
    recorded
      .map(({ contentId, weekStart, population: size, minFame, jobs, closed }) => ({
        week: `${contentId}/${formatResetDate(weekStart)}`,
        size,
        minFame,
        jobs,
        closed
      }))
      .toSorted((left, right) => left.week.localeCompare(right.week)),
    [
      { week: 'legion-apocalypse/2026-10-29', size: 1000, minFame: 126000, jobs: [], closed: true },
      {
        week: 'legion-apocalypse/2026-11-05',
        size: 1500,
        minFame: 104292,
        jobs: largest.jobs,
        closed: true
      },
      { week: 'legion-venus/2026-10-29', size: 1000, minFame: 126000, jobs: [], closed: true },
      {
        week: 'legion-venus/2026-11-05',
        size: 1500,
        minFame: 104292,
        jobs: largest.jobs,
        closed: true
      }
    ]
  )
  assert.deepEqual(
    sampled
      .map(({ contentId, kind, weekStart }) => `${contentId}/${kind}/${formatResetDate(weekStart)}`)
      .toSorted(),
    [
      'legion-apocalypse/legion/2026-10-29',
      'legion-apocalypse/legion/2026-11-05',
      'legion-venus/legion/2026-10-29',
      'legion-venus/legion/2026-11-05'
    ]
  )
  assert.equal(summary.legions, 4)
})

test('각인된 악몽 1주차 전 주는 상세의 점수 구간과 전체 개요의 점수 분포를 담지 않고, 1주차부터는 담는다', async () => {
  const scoreBand = { kind: 'equipment' as const, score: 50_000, population: 100, cleared: 10 }
  const contentSamples = new Map<string, ClearContentWeekSamples>()
  const overviewScores = new Map<string, number>()
  const service = new ClearWeekSampleService({
    ...emptySampleRepository,
    readPopulations: async () => [
      population('michaela-hard', '2026-10-29', true),
      population('michaela-hard', '2026-11-05', true)
    ],
    readContentWeekSampleWeeks: async () => [],
    readOverviewSampleWeeks: async () => [],
    recordLegionClears: async () => undefined,
    recordPopulation: async () => undefined,
    readScoreBands: async () => [scoreBand],
    readScores: async () => [
      {
        contentId: 'michaela-hard',
        kind: 'equipment',
        characters: 30,
        quantiles: [1, 2, 3, 4, 5],
        max: 6
      }
    ],
    recordContentWeekSamples: async ({ weekStart }, samples) => {
      contentSamples.set(formatResetDate(weekStart), samples)
    },
    recordOverviewSamples: async (weekStart, samples) => {
      overviewScores.set(formatResetDate(weekStart), samples.scores.length)
    }
  })

  await service.recordMissing(() => undefined)

  assert.deepEqual(contentSamples.get('2026-10-29')?.scoreBands, [])
  assert.deepEqual(contentSamples.get('2026-11-05')?.scoreBands, [scoreBand])
  assert.equal(overviewScores.get('2026-10-29'), 0)
  assert.equal(overviewScores.get('2026-11-05'), 1)
})

test('지난주 행의 점수를 쓰는 지난주 대비 그룹 점수는 지난주가 각인된 악몽 1주차 전이면 담지 않는다', async () => {
  const groupScore = {
    group: 'left' as const,
    kind: 'equipment' as const,
    characters: 30,
    quantiles: [1, 2, 3, 4, 5],
    max: 6
  }
  const contentSamples = new Map<string, ClearContentWeekSamples>()
  const service = new ClearWeekSampleService({
    ...emptySampleRepository,
    readPopulations: async () => [
      population('michaela-hard', '2026-11-05', true),
      population('michaela-hard', '2026-11-12', true)
    ],
    readContentWeekSampleWeeks: async () => [],
    readOverviewSampleWeeks: async () => [],
    recordLegionClears: async () => undefined,
    recordPopulation: async () => undefined,
    readWeekGroupScores: async () => [groupScore],
    recordContentWeekSamples: async ({ weekStart }, samples) => {
      contentSamples.set(formatResetDate(weekStart), samples)
    },
    recordOverviewSamples: async () => undefined
  })

  await service.recordMissing(() => undefined)

  assert.deepEqual(contentSamples.get('2026-11-05')?.weekGroupScores, [])
  assert.deepEqual(contentSamples.get('2026-11-12')?.weekGroupScores, [groupScore])
})
