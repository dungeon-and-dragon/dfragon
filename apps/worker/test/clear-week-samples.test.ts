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
import { CLEAR_LEGIONS } from '@dfragon/server-core/domain/content-clears/index.js'
import { addHours } from 'date-fns'

// 합성 분모와 집계다. DB 읽기와 저장은 fake이며 저장한 재료를 다시 읽는 왕복은 container-content-clear-check.mjs가 확인한다.
const week = (date: string) => new Date(`${date}T06:00:00+09:00`)
const emptySampleRepository: ClearSampleRepository = {
  readAdventureSizes: async () => [],
  readContentJobFames: async () => [],
  readContentTimes: async () => [],
  readFameBands: async () => [],
  readWeekGroups: async () => [],
  readWeekMoves: async () => [],
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
// 레기온마다 출시 주부터 주어진 주 전까지 이미 옮기고 상세와 전체 개요까지 저장한 주다.
const movedLegionWeeksBefore = (date: string): StoredClearPopulation[] =>
  CLEAR_LEGIONS.flatMap(({ id, releasedAt }) => {
    const weeks: StoredClearPopulation[] = []

    for (
      let weekStart = releasedAt;
      weekStart < week(date);
      weekStart = addHours(weekStart, 7 * 24)
    ) {
      weeks.push(population(id, formatResetDate(weekStart), true))
    }

    return weeks
  })
const movedLegionWeeks = movedLegionWeeksBefore('2026-10-29')
const movedContentWeeks = movedLegionWeeks.map(({ contentId, weekStart }) => ({
  contentId,
  weekStart
}))
const movedOverviewWeeks = movedLegionWeeks.map(({ weekStart }) => weekStart)

test('마감한 주 집계는 저장하지 않은 마감한 주를 최근 주부터 저장하고, 전체 개요는 그 주의 모든 분모가 마감했을 때만 저장한다', async () => {
  const recordedContents: string[] = []
  const recordedSamples = new Map<string, ClearContentWeekSamples>()
  const recordedOverviews: string[] = []
  const keyOf = ({ contentId, weekStart }: ClearContentWeek) =>
    `${contentId}/${formatResetDate(weekStart)}`
  const service = new ClearWeekSampleService({
    ...emptySampleRepository,
    readPopulations: async () => [
      ...movedLegionWeeks,
      population('michaela-hard', '2026-10-29', true),
      population('michaela-hard', '2026-11-05', true),
      population('engraved-nightmare-1', '2026-11-05', true),
      population('michaela-hard', '2026-11-12', true),
      population('engraved-nightmare-1', '2026-11-12', false),
      population('retired-raid', '2026-11-05', true)
    ],
    readContentWeekSampleWeeks: async () => [
      ...movedContentWeeks,
      { contentId: 'michaela-hard', weekStart: week('2026-10-29') }
    ],
    readOverviewSampleWeeks: async () => [...movedOverviewWeeks, week('2026-10-29')],
    readPopulationJobs: async () => [],
    recordLegionClears: async () => undefined,
    analyzeContentClears: async () => undefined,
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

test('레기온은 출시 주부터 레이드 분모가 마감한 가장 최근 주까지 아직 옮기지 않은 주만 옮기고, 막 마감한 주만 명성과 점수를 복사하게 표시하며, 분모는 입장 명성과 수집 하한 가운데 높은 명성부터 센 뒤 상세 집계를 계산한다', async () => {
  const jobsFrom = (minFame: number) => [
    {
      jobId: 'synthetic-job',
      jobGrowId: 'synthetic-grow',
      jobName: '합성직업',
      jobGrowName: '합성전직',
      count: 200_000 - minFame
    }
  ]
  const populations: StoredClearPopulation[] = [
    ...movedLegionWeeks,
    population('michaela-hard', '2026-04-16', true),
    population('michaela-hard', '2026-10-29', true),
    population('michaela-hard', '2026-11-05', true),
    population('nabel-normal', '2026-11-05', true),
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
        ...movedContentWeeks,
        { contentId: 'michaela-hard', weekStart: week('2026-04-16') },
        { contentId: 'michaela-hard', weekStart: week('2026-10-29') },
        { contentId: 'michaela-hard', weekStart: week('2026-11-05') },
        { contentId: 'nabel-normal', weekStart: week('2026-11-05') },
        { contentId: 'legion-venus', weekStart: week('2026-04-16') }
      ],
      readOverviewSampleWeeks: async () => [
        ...movedOverviewWeeks,
        week('2026-04-16'),
        week('2026-10-29'),
        week('2026-11-05')
      ],
      readPopulationJobs: async (minFame) => jobsFrom(minFame),
      recordLegionClears: async ({ contentId, name, weekStart, copySnapshot }: LegionClearWeek) => {
        moved.push(`${contentId}/${name}/${formatResetDate(weekStart)}/${copySnapshot}`)
      },
      analyzeContentClears: async () => undefined,
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
      {
        week: 'legion-apocalypse/2026-10-29',
        size: 126_007,
        minFame: 73_993,
        jobs: jobsFrom(73_993),
        closed: true
      },
      {
        week: 'legion-apocalypse/2026-11-05',
        size: 126_007,
        minFame: 73_993,
        jobs: jobsFrom(73_993),
        closed: true
      },
      // 베누스 입장 명성 41,929는 수집 하한 47,684보다 낮다.
      {
        week: 'legion-venus/2026-10-29',
        size: 152_316,
        minFame: 47_684,
        jobs: jobsFrom(47_684),
        closed: true
      },
      {
        week: 'legion-venus/2026-11-05',
        size: 152_316,
        minFame: 47_684,
        jobs: jobsFrom(47_684),
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

test('첫 레이드 출시 전에 나온 레기온은 레이드 분모가 없는 출시 주부터 옮기고, 레이드 분모가 없는 주는 전체 개요를 저장하지 않는다', async () => {
  const moved: string[] = []
  const populations: StoredClearPopulation[] = [population('nabel-normal', '2025-04-17', true)]
  const overviews: string[] = []
  const service = new ClearWeekSampleService(
    {
      ...emptySampleRepository,
      readPopulations: async () => populations,
      readContentWeekSampleWeeks: async () => [],
      readOverviewSampleWeeks: async () => [],
      readPopulationJobs: async () => [],
      recordLegionClears: async ({ contentId, weekStart, copySnapshot }: LegionClearWeek) => {
        moved.push(`${contentId}/${formatResetDate(weekStart)}/${copySnapshot}`)
      },
      analyzeContentClears: async () => undefined,
      recordPopulation: async (input) => {
        populations.push({ ...input, jobs: [...input.jobs] })
      },
      recordContentWeekSamples: async () => undefined,
      recordOverviewSamples: async (weekStart) => {
        overviews.push(formatResetDate(weekStart))
      }
    },
    () => week('2025-04-24')
  )

  await service.recordMissing(() => undefined)

  assert.deepEqual(moved.toSorted(), [
    'legion-venus/2025-02-06/false',
    'legion-venus/2025-02-13/false',
    'legion-venus/2025-02-20/false',
    'legion-venus/2025-02-27/false',
    'legion-venus/2025-03-06/false',
    'legion-venus/2025-03-13/false',
    'legion-venus/2025-03-20/false',
    'legion-venus/2025-03-27/false',
    'legion-venus/2025-04-03/false',
    'legion-venus/2025-04-10/false',
    'legion-venus/2025-04-17/true'
  ])
  assert.deepEqual(overviews, ['2025-04-17'])
})

// 새로 쌓인 주를 통계 없이 집계하면 planner가 그 주를 한 행으로 보고 끝나지 않는 계획을 골라, 집계 전에 통계를 다시 모아야 한다.
// 레기온을 옮긴 뒤 집계 전에 멈춘 실행도 다음 실행에서 통계를 모아야 해, 옮길 주가 없어도 집계할 주가 있으면 모은다.
test('집계할 마감한 주가 있으면 레기온을 옮긴 뒤 집계 전에 클리어 통계를 다시 모으고, 집계할 주가 없으면 모으지 않는다', async () => {
  const run = async (
    populations: StoredClearPopulation[],
    sampledWeeks: { contentId: string; weekStart: Date }[] = []
  ) => {
    const steps: string[] = []
    const step = (name: string) => {
      if (steps.at(-1) !== name) {
        steps.push(name)
      }
    }

    const service = new ClearWeekSampleService(
      {
        ...emptySampleRepository,
        readPopulations: async () => populations,
        readContentWeekSampleWeeks: async () => sampledWeeks,
        readOverviewSampleWeeks: async () => sampledWeeks.map(({ weekStart }) => weekStart),
        readPopulationJobs: async () => [],
        recordLegionClears: async () => step('move'),
        analyzeContentClears: async () => step('analyze'),
        recordPopulation: async () => undefined,
        readContentJobFames: async () => {
          step('sample')

          return []
        },
        recordContentWeekSamples: async () => undefined,
        recordOverviewSamples: async () => undefined
      },
      () => week('2025-04-24')
    )

    await service.recordMissing(() => undefined)

    return steps
  }

  const raidWeek = population('nabel-normal', '2025-04-17', true)
  const movedWeeks = [...movedLegionWeeksBefore('2025-04-24'), raidWeek]

  assert.deepEqual(await run([raidWeek]), ['move', 'analyze', 'sample'])
  assert.deepEqual(await run(movedWeeks), ['analyze', 'sample'])
  assert.deepEqual(await run(movedWeeks, movedWeeks), [])
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
    readPopulationJobs: async () => [],
    recordLegionClears: async () => undefined,
    analyzeContentClears: async () => undefined,
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
    readPopulationJobs: async () => [],
    recordLegionClears: async () => undefined,
    analyzeContentClears: async () => undefined,
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
