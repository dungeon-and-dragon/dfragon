import assert from 'node:assert/strict'
import test from 'node:test'
import type {
  ClearJobFameSample,
  ClearStageMoveSelection,
  ClearWeekComparison,
  ClearWeekGroupSample,
  ClearWeekRatioCount,
  ClearWeekSelection,
  StoredClearPopulation
} from '@dfragon/database'
import type { HttpAppHandle } from '@dfragon/http-server'
import { CatalogService } from '../src/application/character-catalog/service.js'
import { formatResetDate } from '../src/domain/seoul-time.js'
import type { ClearStats } from '../src/domain/content-clears/stats.js'
import type { ClearStatsRepository } from '../src/application/content-clears/repository.js'
import { createApiHttpApp } from '../src/runtime/api-app.js'

// 합성 집계다. DB 읽기는 fake이며 SQL의 주 고르기, 직업과 모험단 묶기는 container-content-clear-check.mjs가 실제 DB로 확인한다.
const at = (time: string) => new Date(`${time}+09:00`)
const week = (date: string) => at(`${date}T06:00:00`)
const job = { jobId: 'synthetic-job', jobGrowId: 'synthetic-grow', jobName: '합성직업' }
const population = (
  contentId: string,
  date: string,
  size: number,
  closed = true,
  collectedAt = '2026-11-10T06:30:00'
): StoredClearPopulation => ({
  contentId,
  weekStart: week(date),
  population: size,
  minFame: 126000,
  jobs: [{ ...job, jobGrowName: '합성전직', count: size }],
  collectedAt: at(collectedAt),
  closed
})
const count = (
  contentId: string,
  date: string,
  ratio: number | null,
  cleared: number
): ClearWeekRatioCount => ({ contentId, weekStart: week(date), ratio, cleared })

const noScores = { equipment: null, buff: null }

const populations = [
  population('michaela-hard', '2026-11-05', 1000, false),
  population('michaela-hard', '2026-10-29', 900),
  population('diregie-hard', '2026-02-05', 800),
  population('diregie-hard', '2026-02-12', 850),
  population('engraved-nightmare-1', '2026-11-05', 1000)
]
const counts = [
  count('michaela-hard', '2026-11-05', 500, 3),
  count('michaela-hard', '2026-11-05', null, 10),
  count('michaela-hard', '2026-11-05', 50, 2),
  count('michaela-hard', '2026-10-29', null, 7),
  count('diregie-hard', '2026-02-05', null, 4),
  count('diregie-hard', '2026-02-12', null, 6),
  // 챌린지는 모집단을 저장하지 않은 출시 전 구간에도 기록이 있을 수 있다.
  count('engraved-nightmare-1', '2026-10-29', null, 1),
  count('engraved-nightmare-1', '2026-11-05', null, 5),
  count('engraved-nightmare-1', '2026-11-12', null, 100)
]

function fakeReader(overrides: Partial<ClearStatsRepository> = {}): ClearStatsRepository {
  return {
    readCollectedAt: async () => at('2026-11-10T06:30:00'),
    readPopulations: async () => populations,
    readWeekRatioCounts: async () => counts,
    readAdventureSizes: async () => [],
    readContentJobFames: async () => [],
    readContentTimes: async () => [],
    readFirstWeeks: async () => [],
    readFameBands: async () => [],
    readWeekGroups: async () => [],
    readStageMoves: async () => [],
    readStreaks: async () => [],
    readLegionWeeks: async () => [],
    readRaidModes: async () => [],
    readRaidStageCounts: async () => [],
    readContentJobScores: async () => [],
    readWeekGroupScores: async () => [],
    readScoreBands: async () => [],
    readScores: async () => [],
    readJobScores: async () => [],
    readFames: async () => [],
    readJobFames: async () => [],
    readCoClears: async () => [],
    readRaidTimes: async () => [],
    ...overrides
  }
}

async function listen(clearStats?: ClearStatsRepository): Promise<{
  app: HttpAppHandle
  origin: string
  refreshClearStats: () => Promise<void>
}> {
  const unused = async (): Promise<never> => assert.fail('Neople을 부르면 안 된다')
  const { app, refreshClearStats } = await createApiHttpApp({
    search: { searchCharacters: unused },
    details: { fetchDetails: unused, catalog: new CatalogService(unused) },
    todayGrade: { fetchShopGrade: unused },
    clearStats,
    writeAccessLog: () => undefined
  })
  await app.listen(0, '127.0.0.1')

  return { app, origin: await app.getUrl(), refreshClearStats }
}

function gate() {
  let open!: () => void
  let reached!: () => void
  const opened = new Promise<void>((resolve) => {
    open = resolve
  })
  const arrived = new Promise<void>((resolve) => {
    reached = resolve
  })

  return {
    open,
    arrived,
    async pass() {
      reached()
      await opened
    }
  }
}

async function getJson(origin: string, path: string) {
  const response = await fetch(new URL(path, origin))
  const body = await response.json()

  return { status: response.status, body }
}

function contentOf(body: ClearStats, id: string) {
  const content = body.contents.find((candidate) => candidate.id === id)
  assert.ok(content, id)

  return content
}

test('클리어 목록은 레이드를 주마다 세고 배율별 수의 합이 클리어 수와 같다', async () => {
  const { app, origin } = await listen(fakeReader())
  try {
    const { status, body } = await getJson(origin, '/stats/clears')

    assert.equal(status, 200)
    assert.deepEqual(contentOf(body, 'michaela-hard'), {
      id: 'michaela-hard',
      kind: 'raid',
      name: '무너진 성자 미카엘라 (하드)',
      releasedAt: '2026-08-05T21:00:00.000Z',
      entryFame: 104_292,
      latest: true,
      weeks: [
        {
          weekStart: '2026-10-29',
          closed: true,
          collectedAt: '2026-11-09T21:30:00.000Z',
          population: 900,
          minFame: 126000,
          cleared: 7,
          newlyCleared: null,
          ratios: [{ ratio: null, cleared: 7 }]
        },
        {
          weekStart: '2026-11-05',
          closed: false,
          collectedAt: '2026-11-09T21:30:00.000Z',
          population: 1000,
          minFame: 126000,
          cleared: 15,
          newlyCleared: null,
          ratios: [
            { ratio: null, cleared: 10 },
            { ratio: 50, cleared: 2 },
            { ratio: 500, cleared: 3 }
          ]
        }
      ]
    })
  } finally {
    await app.close()
  }
})

test('챌린지의 클리어 수는 그 주 끝까지의 누적이고 그 주 신규를 따로 준다', async () => {
  const { app, origin } = await listen(fakeReader())
  try {
    const { body } = await getJson(origin, '/stats/clears')
    const [weekSummary] = contentOf(body, 'engraved-nightmare-1').weeks

    assert.deepEqual(
      {
        cleared: weekSummary.cleared,
        newlyCleared: weekSummary.newlyCleared,
        ratios: weekSummary.ratios
      },
      { cleared: 6, newlyCleared: 5, ratios: [{ ratio: null, cleared: 6 }] }
    )
  } finally {
    await app.close()
  }
})

test('구 컨텐츠도 저장된 주를 모두 주고, 수집 기록이 없는 컨텐츠는 weeks가 빈 배열이다', async () => {
  const { app, origin } = await listen(fakeReader())
  try {
    const { body } = await getJson(origin, '/stats/clears')
    const diregie = contentOf(body, 'diregie-hard')

    assert.equal(diregie.latest, false)
    assert.deepEqual(
      diregie.weeks.map(({ weekStart, cleared }) => [weekStart, cleared]),
      [
        ['2026-02-05', 4],
        ['2026-02-12', 6]
      ]
    )
    assert.deepEqual(contentOf(body, 'nabel-normal').weeks, [])
  } finally {
    await app.close()
  }
})

test('컨텐츠 상세는 week가 없으면 가장 최근 주를 읽고, 저장된 주면 구 컨텐츠라도 그 주를 읽는다', async () => {
  const selections: ClearWeekSelection[] = []
  const { app, origin } = await listen(
    fakeReader({
      readContentJobFames: async (selection) => {
        selections.push(selection)

        return []
      }
    })
  )
  try {
    const latest = await getJson(origin, '/stats/clears/michaela-hard')
    const old = await getJson(origin, '/stats/clears/diregie-hard?week=2026-02-05')

    assert.equal(latest.status, 200)
    assert.equal(latest.body.week.weekStart, '2026-11-05')
    assert.equal(old.status, 200)
    assert.equal(old.body.week.weekStart, '2026-02-05')
    assert.deepEqual(selections, [
      { contentId: 'michaela-hard', kind: 'raid', weekStart: week('2026-11-05') },
      { contentId: 'diregie-hard', kind: 'raid', weekStart: week('2026-02-05') }
    ])
  } finally {
    await app.close()
  }
})

test('컨텐츠 상세의 직업별 클리어 수는 모집단에 없는 전직도 넣어 합이 그 주 클리어 수와 같다', async () => {
  const noFame = { contentId: 'michaela-hard', characters: 0, quantiles: null, max: null }
  const jobFames: ClearJobFameSample[] = [
    { ...noFame, ...job, jobGrowName: '합성전직', cleared: 12 },
    { ...noFame, ...job, jobGrowId: 'synthetic-other', jobGrowName: '합성다른전직', cleared: 2 },
    { ...noFame, jobId: null, jobGrowId: null, jobName: null, jobGrowName: null, cleared: 1 }
  ]
  const adventures = [
    { characters: 1, adventures: 5 },
    { characters: 2, adventures: 5 }
  ]
  const { app, origin } = await listen(
    fakeReader({
      readContentJobFames: async () => jobFames,
      readAdventureSizes: async () => adventures
    })
  )
  try {
    const { status, body } = await getJson(origin, '/stats/clears/michaela-hard?week=2026-11-05')

    assert.equal(status, 200)
    const jobs = [...body.jobs].sort((left, right) => right.cleared - left.cleared)
    assert.deepEqual(jobs, [
      {
        ...job,
        jobGrowName: '합성전직',
        population: 1000,
        cleared: 12,
        fame: null,
        scores: noScores
      },
      {
        ...job,
        jobGrowId: 'synthetic-other',
        jobGrowName: '합성다른전직',
        population: 0,
        cleared: 2,
        fame: null,
        scores: noScores
      },
      {
        jobId: null,
        jobGrowId: null,
        jobName: null,
        jobGrowName: null,
        population: 0,
        cleared: 1,
        fame: null,
        scores: noScores
      }
    ])
    assert.deepEqual(body.adventures, adventures)
    assert.equal(body.week.cleared, 15)
  } finally {
    await app.close()
  }
})

test('컨텐츠 상세는 저장되지 않은 주와 잘못된 week를 400, 모르는 컨텐츠를 404로 거절한다', async () => {
  const { app, origin } = await listen(fakeReader())
  try {
    for (const path of [
      '/stats/clears/michaela-hard?week=2026-11-12',
      '/stats/clears/diregie-hard?week=2026-02-19',
      '/stats/clears/michaela-hard?week=2026-11-05T06:00:00%2B09:00',
      '/stats/clears/michaela-hard?week=2026-11-05&week=2026-10-29'
    ]) {
      const { status, body } = await getJson(origin, path)
      assert.equal(status, 400, path)
      assert.equal(body.error.code, 'INVALID_CHARACTER_QUERY', path)
    }

    const unknown = await getJson(origin, '/stats/clears/legion-unknown')
    assert.equal(unknown.status, 404)
    assert.equal(unknown.body.error.code, 'CHARACTER_NOT_FOUND')
  } finally {
    await app.close()
  }
})

test('클리어 집계는 마지막 수집 시각이 같으면 캐시를 쓰고, 바뀌면 새 값을 미리 계산하는 동안 이전 값을 준다', async () => {
  let collectedAt = at('2026-11-10T06:30:00')
  let cleared = 10
  let reads = 0
  const { app, origin, refreshClearStats } = await listen(
    fakeReader({
      readCollectedAt: async () => collectedAt,
      readWeekRatioCounts: async () => {
        reads += 1

        return [count('michaela-hard', '2026-11-05', null, cleared)]
      }
    })
  )
  const michaelaCleared = async () => {
    const { body } = await getJson(origin, '/stats/clears')

    return contentOf(body, 'michaela-hard').weeks.at(-1)?.cleared
  }
  try {
    assert.equal(await michaelaCleared(), 10)
    cleared = 20
    assert.equal(await michaelaCleared(), 10)
    assert.equal(reads, 1)

    collectedAt = at('2026-11-11T06:30:00')
    assert.equal(await michaelaCleared(), 10)
    await refreshClearStats()
    assert.equal(await michaelaCleared(), 20)
    assert.equal((await getJson(origin, '/stats/clears/michaela-hard')).body.week.cleared, 20)
    assert.equal(reads, 2)
  } finally {
    await app.close()
  }
})

test('클리어 목록은 읽기 실패를 캐시하지 않는다', async () => {
  let failing = true
  const { app, origin } = await listen(
    fakeReader({
      readPopulations: async () => {
        if (failing) {
          throw new Error('synthetic database failure')
        }

        return populations
      }
    })
  )
  try {
    assert.equal((await getJson(origin, '/stats/clears')).status, 500)
    failing = false
    assert.equal((await getJson(origin, '/stats/clears')).status, 200)
  } finally {
    await app.close()
  }
})

test('DB 설정이 없는 API는 모든 컨텐츠의 weeks를 빈 배열로, 상세의 week를 null로 준다', async () => {
  const { app, origin } = await listen()
  try {
    const list = await getJson(origin, '/stats/clears')
    const detail = await getJson(origin, '/stats/clears/michaela-hard')

    assert.equal(list.status, 200)
    assert.ok(list.body.contents.length > 0)
    assert.ok(list.body.contents.every(({ weeks }: { weeks: unknown[] }) => weeks.length === 0))
    assert.equal(detail.status, 200)
    const { weeks: _weeks, ...header } = contentOf(list.body, 'michaela-hard')
    assert.deepEqual(detail.body, {
      ...header,
      week: null,
      jobs: [],
      adventures: [],
      weeklyClears: [],
      fameBands: [],
      weekOverWeek: null,
      stageMoves: null,
      streaks: null,
      stages: null,
      scoreBands: { equipment: [], buff: [] },
      weekdays: [],
      hours: []
    })
  } finally {
    await app.close()
  }
})

const fameSample = (characters: number, low: number) => ({
  characters,
  quantiles: [low, low + 1, low + 2, low + 3, low + 4],
  max: low + 5
})

test('전체 개요는 week가 없으면 가장 최근 주를 모든 컨텐츠에 읽고, 그 주를 저장한 컨텐츠만 준다', async () => {
  const weekStarts: Date[] = []
  const { app, origin } = await listen(
    fakeReader({
      readFames: async (weekStart) => {
        weekStarts.push(weekStart)

        return []
      }
    })
  )
  try {
    const latest = await getJson(origin, '/stats/clears/overview')
    const old = await getJson(origin, '/stats/clears/overview?week=2026-02-05')

    assert.equal(latest.status, 200)
    assert.equal(latest.body.weekStart, '2026-11-05')
    assert.deepEqual(
      latest.body.contents.map(({ id }: { id: string }) => id),
      ['michaela-hard', 'engraved-nightmare-1']
    )
    assert.equal(old.body.weekStart, '2026-02-05')
    assert.deepEqual(
      old.body.contents.map(({ id }: { id: string }) => id),
      ['diregie-hard']
    )
    assert.deepEqual(weekStarts, [week('2026-11-05'), week('2026-02-05')])
  } finally {
    await app.close()
  }
})

test('전체 개요의 명성 분포는 분위수에 이름을 붙이고, 명성 있는 캐릭터가 20명 미만인 줄은 null이다', async () => {
  const jobFames: ClearJobFameSample[] = [
    {
      contentId: 'michaela-hard',
      ...job,
      jobGrowName: '합성전직',
      cleared: 21,
      ...fameSample(20, 110_000)
    },
    {
      contentId: 'michaela-hard',
      ...job,
      jobGrowId: 'synthetic-other',
      jobGrowName: '합성다른전직',
      cleared: 19,
      ...fameSample(19, 120_000)
    },
    {
      contentId: 'michaela-hard',
      jobId: null,
      jobGrowId: null,
      jobName: null,
      jobGrowName: null,
      cleared: 1,
      characters: 0,
      quantiles: null,
      max: null
    }
  ]
  const { app, origin } = await listen(
    fakeReader({
      readFames: async () => [
        { contentId: 'michaela-hard', ...fameSample(40, 100_000) },
        { contentId: 'engraved-nightmare-1', ...fameSample(19, 130_000) }
      ],
      readJobFames: async () => jobFames
    })
  )
  try {
    const { status, body } = await getJson(origin, '/stats/clears/overview?week=2026-11-05')
    const [michaela, challenge] = body.contents

    assert.equal(status, 200)
    assert.deepEqual(michaela.fame, {
      p5: 100_000,
      p25: 100_001,
      median: 100_002,
      p75: 100_003,
      p95: 100_004,
      max: 100_005
    })
    assert.equal(challenge.fame, null)
    const jobs = [...michaela.jobs].sort((left, right) => right.cleared - left.cleared)
    assert.deepEqual(
      jobs.map(({ jobGrowId, population, cleared, fame }: Record<string, unknown>) => [
        jobGrowId,
        population,
        cleared,
        fame === null ? null : (fame as { median: number }).median
      ]),
      [
        ['synthetic-grow', 1000, 21, 110_002],
        ['synthetic-other', 0, 19, null],
        [null, 0, 1, null]
      ]
    )
    assert.equal(michaela.cleared, 41)
  } finally {
    await app.close()
  }
})

test('함께 깬 컨텐츠는 그 주를 저장한 다른 컨텐츠마다 주고 기준 컨텐츠 자신은 넣지 않는다', async () => {
  const { app, origin } = await listen(
    fakeReader({
      readPopulations: async () => [
        ...populations,
        population('michaela-normal', '2026-11-05', 500, false)
      ],
      readCoClears: async () => [
        { contentId: 'michaela-hard', otherContentId: 'engraved-nightmare-1', cleared: 4 },
        { contentId: 'engraved-nightmare-1', otherContentId: 'michaela-hard', cleared: 4 }
      ]
    })
  )
  try {
    const { body } = await getJson(origin, '/stats/clears/overview')

    assert.deepEqual(
      body.contents.map(({ id, coClears }: { id: string; coClears: unknown }) => [id, coClears]),
      [
        [
          'michaela-normal',
          [
            { id: 'michaela-hard', cleared: 0 },
            { id: 'engraved-nightmare-1', cleared: 0 }
          ]
        ],
        [
          'michaela-hard',
          [
            { id: 'michaela-normal', cleared: 0 },
            { id: 'engraved-nightmare-1', cleared: 4 }
          ]
        ],
        [
          'engraved-nightmare-1',
          [
            { id: 'michaela-normal', cleared: 0 },
            { id: 'michaela-hard', cleared: 4 }
          ]
        ]
      ]
    )
  } finally {
    await app.close()
  }
})

test('요일은 목요일부터 일곱 칸, 시간대는 0시부터 스물네 칸이고 각 합이 레이드 클리어 수의 합과 같다', async () => {
  const raidTimes = [
    { weekday: 4, hour: 21, cleared: 3 },
    { weekday: 6, hour: 21, cleared: 5 },
    { weekday: 4, hour: 2, cleared: 2 },
    { weekday: 3, hour: 0, cleared: 1 }
  ]
  const { app, origin } = await listen(fakeReader({ readRaidTimes: async () => raidTimes }))
  try {
    const { body } = await getJson(origin, '/stats/clears/overview')
    const hours = new Array(24).fill(0)
    hours[0] = 1
    hours[2] = 2
    hours[21] = 8

    assert.deepEqual(body.weekdays, [
      { weekday: 4, cleared: 5 },
      { weekday: 5, cleared: 0 },
      { weekday: 6, cleared: 5 },
      { weekday: 7, cleared: 0 },
      { weekday: 1, cleared: 0 },
      { weekday: 2, cleared: 0 },
      { weekday: 3, cleared: 1 }
    ])
    assert.deepEqual(
      body.hours,
      hours.map((cleared, hour) => ({ hour, cleared }))
    )
  } finally {
    await app.close()
  }
})

test('전체 개요는 저장되지 않은 주와 잘못된 week를 400으로 거절하고, DB 설정이 없으면 빈 개요를 준다', async () => {
  const { app, origin } = await listen(fakeReader())
  try {
    for (const path of [
      '/stats/clears/overview?week=2026-11-12',
      '/stats/clears/overview?week=2026-11-05T06:00:00%2B09:00'
    ]) {
      const { status, body } = await getJson(origin, path)
      assert.equal(status, 400, path)
      assert.equal(body.error.code, 'INVALID_CHARACTER_QUERY', path)
    }
  } finally {
    await app.close()
  }

  const empty = await listen()
  try {
    const { status, body } = await getJson(empty.origin, '/stats/clears/overview')

    assert.equal(status, 200)
    assert.deepEqual(body, { weekStart: null, contents: [], weekdays: [], hours: [] })
  } finally {
    await empty.app.close()
  }
})

test('전체 개요는 마지막 수집 시각이 같으면 다시 읽지 않고, 바뀌면 미리 계산한 새 값을 준다', async () => {
  let collectedAt = at('2026-11-10T06:30:00')
  let reads = 0
  const { app, origin, refreshClearStats } = await listen(
    fakeReader({
      readCollectedAt: async () => collectedAt,
      readRaidTimes: async () => {
        reads += 1

        return [{ weekday: 4, hour: 21, cleared: reads }]
      }
    })
  )
  const thursdayCleared = async () =>
    (await getJson(origin, '/stats/clears/overview')).body.weekdays[0].cleared
  try {
    assert.equal(await thursdayCleared(), 1)
    assert.equal(await thursdayCleared(), 1)
    assert.equal(reads, 1)

    collectedAt = at('2026-11-11T06:30:00')
    assert.equal(await thursdayCleared(), 1)
    await refreshClearStats()
    assert.equal(reads, 2)
    assert.equal(await thursdayCleared(), 2)
    assert.equal(reads, 2)
  } finally {
    await app.close()
  }
})

test('미리 계산은 최신 주의 전체 개요와 컨텐츠마다 가장 최근 주의 상세를 계산해, 그 뒤 요청은 다시 계산하지 않는다', async () => {
  const overviewWeeks: string[] = []
  const detailWeeks: string[] = []
  const { app, origin, refreshClearStats } = await listen(
    fakeReader({
      readFames: async (weekStart) => {
        overviewWeeks.push(formatResetDate(weekStart))

        return []
      },
      readContentJobFames: async ({ contentId, weekStart }) => {
        detailWeeks.push(`${contentId}/${formatResetDate(weekStart)}`)

        return []
      }
    })
  )
  try {
    await refreshClearStats()
    const expectedDetails = [
      'diregie-hard/2026-02-12',
      'engraved-nightmare-1/2026-11-05',
      'michaela-hard/2026-11-05'
    ]

    assert.deepEqual(overviewWeeks, ['2026-11-05'])
    assert.deepEqual(detailWeeks.toSorted(), expectedDetails)

    for (const path of [
      '/stats/clears',
      '/stats/clears/overview',
      '/stats/clears/michaela-hard',
      '/stats/clears/diregie-hard',
      '/stats/clears/engraved-nightmare-1'
    ]) {
      assert.equal((await getJson(origin, path)).status, 200, path)
    }
    assert.deepEqual(overviewWeeks, ['2026-11-05'])
    assert.deepEqual(detailWeeks.toSorted(), expectedDetails)
  } finally {
    await app.close()
  }
})

// 운영 장애(2026-11-14): 상세 하나가 쿼리 12개를 함께 보내고 상세 요청 여러 개가 함께 돌아 DB 연결을 모두 잡았다.
test('목록, 전체 개요, 컨텐츠 상세 요청이 함께 와도 DB 읽기는 한 번에 하나씩 보낸다', async () => {
  let running = 0
  let maxRunning = 0
  const counted =
    <Args extends unknown[], T>(read: (...args: Args) => Promise<T>) =>
    async (...args: Args): Promise<T> => {
      running += 1
      maxRunning = Math.max(maxRunning, running)
      await new Promise((resolve) => setImmediate(resolve))
      const value = await read(...args)
      running -= 1

      return value
    }
  const base = fakeReader()
  const reader: ClearStatsRepository = {
    readCollectedAt: base.readCollectedAt,
    readPopulations: counted(base.readPopulations),
    readWeekRatioCounts: counted(base.readWeekRatioCounts),
    readAdventureSizes: counted(base.readAdventureSizes),
    readContentJobFames: counted(base.readContentJobFames),
    readContentTimes: counted(base.readContentTimes),
    readFirstWeeks: counted(base.readFirstWeeks),
    readFameBands: counted(base.readFameBands),
    readWeekGroups: counted(base.readWeekGroups),
    readStageMoves: counted(base.readStageMoves),
    readStreaks: counted(base.readStreaks),
    readLegionWeeks: counted(base.readLegionWeeks),
    readRaidModes: counted(base.readRaidModes),
    readRaidStageCounts: counted(base.readRaidStageCounts),
    readContentJobScores: counted(base.readContentJobScores),
    readWeekGroupScores: counted(base.readWeekGroupScores),
    readScoreBands: counted(base.readScoreBands),
    readScores: counted(base.readScores),
    readJobScores: counted(base.readJobScores),
    readFames: counted(base.readFames),
    readJobFames: counted(base.readJobFames),
    readCoClears: counted(base.readCoClears),
    readRaidTimes: counted(base.readRaidTimes)
  }

  const { app, origin } = await listen(reader)
  try {
    const paths = [
      '/stats/clears',
      '/stats/clears/overview',
      '/stats/clears/overview?week=2026-02-05',
      '/stats/clears/michaela-hard',
      '/stats/clears/michaela-hard?week=2026-10-29',
      '/stats/clears/diregie-hard?week=2026-02-05',
      '/stats/clears/engraved-nightmare-1'
    ]
    const responses = await Promise.all(paths.map((path) => getJson(origin, path)))

    assert.deepEqual(
      responses.map(({ status }) => status),
      paths.map(() => 200)
    )
    assert.equal(maxRunning, 1)
  } finally {
    await app.close()
  }
})

test('새 값을 미리 계산하는 동안 이전 결과에 없는 주를 고른 요청은 남은 미리 계산을 다 기다리지 않고 지금 도는 계산 다음에 계산한다', async () => {
  let collectedAt = at('2026-11-10T06:30:00')
  const overviewGate = gate()
  let gated = false
  let requestArrived: () => void = () => undefined
  const detailWeeks: string[] = []
  const { app, origin, refreshClearStats } = await listen(
    fakeReader({
      readCollectedAt: async () => {
        requestArrived()

        return collectedAt
      },
      readFames: async () => {
        if (gated) {
          await overviewGate.pass()
        }

        return []
      },
      readContentJobFames: async ({ contentId, weekStart }) => {
        detailWeeks.push(`${contentId}/${formatResetDate(weekStart)}`)

        return []
      }
    })
  )
  try {
    await refreshClearStats()
    detailWeeks.length = 0
    gated = true
    collectedAt = at('2026-11-11T06:30:00')
    const refreshed = refreshClearStats()
    await overviewGate.arrived

    const arrived = new Promise<void>((resolve) => {
      requestArrived = resolve
    })
    const old = getJson(origin, '/stats/clears/diregie-hard?week=2026-02-05')
    await arrived
    // 마지막 수집 시각을 읽은 요청이 줄에 들어갈 때까지 한 번 양보한 뒤 미리 계산을 이어 가게 한다.
    await new Promise((resolve) => setImmediate(resolve))
    overviewGate.open()

    assert.equal((await old).status, 200)
    await refreshed
    assert.equal(detailWeeks[0], 'diregie-hard/2026-02-05')
    assert.deepEqual(detailWeeks.slice(1).toSorted(), [
      'diregie-hard/2026-02-12',
      'engraved-nightmare-1/2026-11-05',
      'michaela-hard/2026-11-05'
    ])
  } finally {
    await app.close()
  }
})

// 운영 DB에서 여섯 읽기를 함께 보내면 병렬 worker의 공유 메모리가 모자라 실패했다.
test('전체 개요는 한 주의 모든 컨텐츠를 읽는 쿼리를 동시에 보내지 않는다', async () => {
  let running = 0
  let maxRunning = 0
  const reading = async (): Promise<never[]> => {
    running += 1
    maxRunning = Math.max(maxRunning, running)
    await new Promise((resolve) => setImmediate(resolve))
    running -= 1

    return []
  }

  const { app, origin } = await listen(
    fakeReader({
      readFames: reading,
      readJobFames: reading,
      readScores: reading,
      readJobScores: reading,
      readCoClears: reading,
      readRaidTimes: reading
    })
  )

  try {
    const { status } = await getJson(origin, '/stats/clears/overview')

    assert.equal(status, 200)
    assert.equal(maxRunning, 1)
  } finally {
    await app.close()
  }
})

// reader 행이 식별 필드를 함께 가져와도 응답으로 옮기지 않는지 본다. 값은 합성이다.
const identifying = {
  serverId: 'synthetic-server',
  characterId: 'synthetic-character',
  characterName: '합성캐릭터',
  adventureName: '합성모험단',
  guildName: '합성길드'
}

test('전체 개요 응답은 reader 행에 섞인 캐릭터, 모험단, 길드 값을 옮기지 않는다', async () => {
  const fames = [{ contentId: 'michaela-hard', ...fameSample(40, 100_000), ...identifying }]
  const jobFames = [
    {
      contentId: 'michaela-hard',
      ...job,
      jobGrowName: '합성전직',
      cleared: 40,
      ...fameSample(40, 100_000),
      ...identifying
    }
  ]
  const coClears = [
    {
      contentId: 'michaela-hard',
      otherContentId: 'engraved-nightmare-1',
      cleared: 4,
      ...identifying
    }
  ]
  const raidTimes = [{ weekday: 4, hour: 21, cleared: 40, ...identifying }]
  const { app, origin } = await listen(
    fakeReader({
      readFames: async () => fames,
      readJobFames: async () => jobFames,
      readCoClears: async () => coClears,
      readRaidTimes: async () => raidTimes
    })
  )
  try {
    const response = await fetch(new URL('/stats/clears/overview', origin))
    const text = await response.text()

    assert.equal(response.status, 200)
    for (const [field, value] of Object.entries(identifying)) {
      assert.ok(!text.includes(field), field)
      assert.ok(!text.includes(value), value)
    }
  } finally {
    await app.close()
  }
})

const groupSample = (group: ClearWeekGroupSample['group'], cleared: number, famed: number) => ({
  group,
  cleared,
  ...fameSample(famed, 110_000)
})

test('레이드 상세는 이번 주와 지난주로 그룹, 연속 주 수를 읽고 일반과 하드 짝으로 이동을 읽는다', async () => {
  const comparisons: ClearWeekComparison[] = []
  const stageSelections: ClearStageMoveSelection[] = []
  const { app, origin } = await listen(
    fakeReader({
      readWeekGroups: async (comparison) => {
        comparisons.push(comparison)

        return [
          groupSample('both', 9, 20),
          groupSample('returned', 3, 3),
          groupSample('first', 3, 3)
        ]
      },
      readStageMoves: async (selection) => {
        stageSelections.push(selection)

        return [
          { contentId: 'michaela-hard', previous: 'same', characters: 9 },
          { contentId: 'michaela-hard', previous: 'other', characters: 4 },
          { contentId: 'michaela-normal', previous: 'other', characters: 2 }
        ]
      },
      readStreaks: async () => [
        { weeks: 1, characters: 6 },
        { weeks: 2, characters: 9 }
      ]
    })
  )
  try {
    const { status, body } = await getJson(origin, '/stats/clears/michaela-hard?week=2026-11-05')

    assert.equal(status, 200)
    assert.deepEqual(comparisons, [
      {
        contentId: 'michaela-hard',
        weekStart: week('2026-11-05'),
        previousWeekStart: week('2026-10-29')
      }
    ])
    assert.deepEqual(stageSelections, [
      {
        hardContentId: 'michaela-hard',
        normalContentId: 'michaela-normal',
        weekStart: week('2026-11-05'),
        previousWeekStart: week('2026-10-29')
      }
    ])
    assert.deepEqual(
      Object.fromEntries(
        Object.entries(body.weekOverWeek).map(([group, stats]) => {
          const { cleared, fame } = stats as { cleared: number; fame: { median: number } | null }

          return [group, [cleared, fame?.median ?? null]]
        })
      ),
      { both: [9, 110_002], returned: [3, null], left: [0, null], first: [3, null] }
    )
    assert.deepEqual(body.stageMoves, {
      hard: { same: 9, other: 4, none: 0 },
      normal: { same: 0, other: 2, none: 0 }
    })
    assert.deepEqual(body.streaks, [
      { weeks: 1, characters: 6 },
      { weeks: 2, characters: 9 }
    ])
  } finally {
    await app.close()
  }
})

test('챌린지 상세는 지난주 대비, 이동, 연속 주 수를 읽지 않고 null로 준다', async () => {
  const unread = async (): Promise<never> => assert.fail('챌린지에서 읽으면 안 된다')
  const { app, origin } = await listen(
    fakeReader({ readWeekGroups: unread, readStageMoves: unread, readStreaks: unread })
  )
  try {
    const { status, body } = await getJson(origin, '/stats/clears/engraved-nightmare-1')

    assert.equal(status, 200)
    assert.deepEqual(
      { weekOverWeek: body.weekOverWeek, stageMoves: body.stageMoves, streaks: body.streaks },
      { weekOverWeek: null, stageMoves: null, streaks: null }
    )
  } finally {
    await app.close()
  }
})

test('일반과 하드가 따로 없는 레이드 상세는 이동을 읽지 않고 null로 준다', async () => {
  const unread = async (): Promise<never> => assert.fail('짝이 없는 레이드에서 읽으면 안 된다')
  const { app, origin } = await listen(
    fakeReader({
      readPopulations: async () => [...populations, population('inae-twilight', '2026-11-05', 700)],
      readStageMoves: unread
    })
  )
  try {
    const { status, body } = await getJson(origin, '/stats/clears/inae-twilight')

    assert.equal(status, 200)
    assert.equal(body.stageMoves, null)
    assert.notEqual(body.weekOverWeek, null)
  } finally {
    await app.close()
  }
})

test('주차별 첫 클리어와 다시 클리어의 합은 그 주 클리어 수이고, 한 번이라도 깬 수는 그 주까지 처음 깬 수의 합이며 그 주 분모를 함께 준다', async () => {
  const firstWeeks = [
    { weekStart: week('2026-10-22'), characters: 2 },
    { weekStart: week('2026-10-29'), characters: 5 },
    { weekStart: week('2026-11-05'), characters: 4 }
  ]
  const { app, origin } = await listen(
    fakeReader({
      readFirstWeeks: async (contentId) =>
        contentId === 'michaela-hard'
          ? firstWeeks
          : [
              { weekStart: week('2026-10-29'), characters: 1 },
              { weekStart: week('2026-11-05'), characters: 5 },
              { weekStart: week('2026-11-12'), characters: 100 }
            ]
    })
  )
  try {
    const raid = await getJson(origin, '/stats/clears/michaela-hard')
    const challenge = await getJson(origin, '/stats/clears/engraved-nightmare-1')

    assert.deepEqual(raid.body.weeklyClears, [
      {
        weekStart: '2026-10-29',
        population: 900,
        firstCleared: 5,
        repeatCleared: 2,
        everCleared: 7
      },
      {
        weekStart: '2026-11-05',
        population: 1000,
        firstCleared: 4,
        repeatCleared: 11,
        everCleared: 11
      }
    ])
    assert.deepEqual(challenge.body.weeklyClears, [
      {
        weekStart: '2026-11-05',
        population: 1000,
        firstCleared: 5,
        repeatCleared: 1,
        everCleared: 6
      }
    ])
  } finally {
    await app.close()
  }
})

test('명성 구간은 그 주 모집단의 분모 기준 명성으로 읽고, 요일과 시간대는 그 컨텐츠와 그 주로 골라 읽는다', async () => {
  const bandSelections: [ClearWeekSelection, number][] = []
  const timeSelections: ClearWeekSelection[] = []
  const fameBands = [
    { fame: 124_000, population: 0, cleared: 2 },
    { fame: 126_000, population: 40, cleared: 10 }
  ]
  const { app, origin } = await listen(
    fakeReader({
      readFameBands: async (selection, minFame) => {
        bandSelections.push([selection, minFame])

        return fameBands
      },
      readContentTimes: async (selection) => {
        timeSelections.push(selection)

        return [{ weekday: 5, hour: 21, cleared: 15 }]
      }
    })
  )
  try {
    const { body } = await getJson(origin, '/stats/clears/michaela-hard?week=2026-11-05')
    const selection = { contentId: 'michaela-hard', kind: 'raid', weekStart: week('2026-11-05') }

    assert.deepEqual(bandSelections, [[selection, 126000]])
    assert.deepEqual(timeSelections, [selection])
    assert.deepEqual(body.fameBands, fameBands)
    assert.deepEqual(body.weekdays[1], { weekday: 5, cleared: 15 })
    assert.equal(body.hours[21].cleared, 15)
  } finally {
    await app.close()
  }
})

test('분모 기준 명성이 저장되지 않은 주의 명성 구간은 지금 컨텐츠 목록의 분모 기준 명성으로 읽는다', async () => {
  const minFames: number[] = []
  const { app, origin } = await listen(
    fakeReader({
      readPopulations: async () => [
        { ...population('michaela-hard', '2026-11-05', 1000), minFame: null }
      ],
      readFameBands: async (_selection, minFame) => {
        minFames.push(minFame)

        return []
      }
    })
  )
  try {
    await getJson(origin, '/stats/clears/michaela-hard')

    assert.deepEqual(minFames, [104_292])
  } finally {
    await app.close()
  }
})

const legionWeek = (name: string, date: string, cleared: number) => ({
  name,
  weekStart: week(date),
  cleared
})

test('목록은 레기온을 contents와 따로 주고, 레기온 기록이 없으면 그 레기온의 weeks가 빈 배열이다', async () => {
  const { app, origin } = await listen(fakeReader())
  try {
    const { body } = await getJson(origin, '/stats/clears')

    assert.ok(body.contents.every(({ kind }: { kind: string }) => kind !== 'legion'))
    assert.deepEqual(
      body.legions.map(({ id, kind, entryFame, latest, weeks }: Record<string, unknown>) => [
        id,
        kind,
        entryFame,
        latest,
        weeks
      ]),
      [
        ['legion-apocalypse', 'legion', null, true, []],
        ['legion-venus', 'legion', null, false, []]
      ]
    )
  } finally {
    await app.close()
  }
})

test('레기온 주는 첫 기록 주부터 수집한 주마다 두고, 분모는 그 주 가장 큰 모집단이다', async () => {
  const names: (readonly string[])[] = []
  const { app, origin } = await listen(
    fakeReader({
      readPopulations: async () => [...populations, population('nabel-normal', '2026-11-05', 1500)],
      readLegionWeeks: async (legionNames) => {
        names.push(legionNames)

        return [legionWeek('베누스', '2026-10-29', 3), legionWeek('베누스', '2026-11-05', 7)]
      }
    })
  )
  try {
    const { body } = await getJson(origin, '/stats/clears')
    const venus = contentOf({ contents: body.legions, legions: [] }, 'legion-venus')

    assert.deepEqual(names, [['아포칼립스', '베누스']])
    assert.deepEqual(
      venus.weeks.map(({ weekStart, population, cleared, newlyCleared, ratios }) => ({
        weekStart,
        population,
        cleared,
        newlyCleared,
        ratios
      })),
      [
        {
          weekStart: '2026-10-29',
          population: 900,
          cleared: 3,
          newlyCleared: null,
          ratios: [{ ratio: null, cleared: 3 }]
        },
        {
          weekStart: '2026-11-05',
          population: 1500,
          cleared: 7,
          newlyCleared: null,
          ratios: [{ ratio: null, cleared: 7 }]
        }
      ]
    )
  } finally {
    await app.close()
  }
})

test('레기온 상세는 고른 주의 요약만 주고 저장되지 않은 주는 400으로 거절한다', async () => {
  const unread = async (): Promise<never> =>
    assert.fail('레기온 상세에서 클리어 집계를 읽으면 안 된다')
  const { app, origin } = await listen(
    fakeReader({
      readLegionWeeks: async () => [legionWeek('베누스', '2026-11-05', 7)],
      readContentJobFames: unread,
      readFirstWeeks: unread
    })
  )
  try {
    const detail = await getJson(origin, '/stats/clears/legion-venus')
    const rejected = await getJson(origin, '/stats/clears/legion-venus?week=2026-10-29')

    assert.equal(detail.status, 200)
    assert.deepEqual(
      {
        kind: detail.body.kind,
        entryFame: detail.body.entryFame,
        weekStart: detail.body.week.weekStart,
        cleared: detail.body.week.cleared,
        jobs: detail.body.jobs,
        stages: detail.body.stages
      },
      {
        kind: 'legion',
        entryFame: null,
        weekStart: '2026-11-05',
        cleared: 7,
        jobs: [],
        stages: null
      }
    )
    assert.equal(rejected.status, 400)
  } finally {
    await app.close()
  }
})

test('단계별 클리어는 수집 판정과 같은 단계 라벨로 묶어 읽고 단계표 순서로 준다', async () => {
  const stageArguments: Parameters<ClearStatsRepository['readRaidStageCounts']>[] = []
  const { app, origin } = await listen(
    fakeReader({
      readRaidModes: async () => [
        { modeName: '무너진 성자 미카엘라', hard: true },
        { modeName: '미카엘라 : 균열서', hard: false },
        { modeName: '무너진 성자 미카엘라', hard: false }
      ],
      readRaidStageCounts: async (selection, stages) => {
        stageArguments.push([selection, stages])

        return [
          { stage: '하드', characters: 5 },
          { stage: '일반', characters: 9 },
          { stage: '싱글/매칭', characters: 4 }
        ]
      }
    })
  )
  try {
    const { body } = await getJson(origin, '/stats/clears/michaela-hard?week=2026-11-05')
    const [[selection, stages]] = stageArguments

    assert.equal(stageArguments.length, 1)
    assert.deepEqual(selection, { raidName: '무너진 성자 미카엘라', weekStart: week('2026-11-05') })
    assert.deepEqual(
      stages.map(({ modeName, hard, stage }) => `${modeName}/${hard}/${stage}`).sort(),
      [
        '무너진 성자 미카엘라/false/일반',
        '무너진 성자 미카엘라/true/하드',
        '미카엘라 : 균열서/false/싱글/매칭'
      ]
    )
    assert.deepEqual(body.stages, [
      { stage: '싱글/매칭', characters: 4 },
      { stage: '일반', characters: 9 },
      { stage: '하드', characters: 5 }
    ])
  } finally {
    await app.close()
  }
})

test('레이드 기록이 없거나 단계 라벨이 없는 주의 단계별 클리어는 빈 배열이고, 챌린지는 null이다', async () => {
  const unread = async (): Promise<never> =>
    assert.fail('단계 라벨이 없으면 단계별 수를 읽지 않는다')
  const { app, origin } = await listen(
    fakeReader({
      readPopulations: async () => [...populations, population('inae-twilight', '2026-11-05', 700)],
      readRaidModes: async ({ raidName }) =>
        raidName === '이내 황혼전' ? [{ modeName: null, hard: false }] : [],
      readRaidStageCounts: unread
    })
  )
  try {
    const inae = await getJson(origin, '/stats/clears/inae-twilight')
    const michaela = await getJson(origin, '/stats/clears/michaela-hard')
    const challenge = await getJson(origin, '/stats/clears/engraved-nightmare-1')

    assert.deepEqual(inae.body.stages, [])
    assert.deepEqual(michaela.body.stages, [])
    assert.equal(challenge.body.stages, null)
  } finally {
    await app.close()
  }
})

const scoreSample = (kind: 'equipment' | 'buff', characters: number, low: number) => ({
  kind,
  ...fameSample(characters, low)
})

test('점수 분포는 장비 점수와 버프 점수를 따로 두고 20명 미만이거나 점수가 없으면 null이다', async () => {
  const { app, origin } = await listen(
    fakeReader({
      readScores: async () => [
        { contentId: 'michaela-hard', ...scoreSample('equipment', 30, 900_000) },
        { contentId: 'michaela-hard', ...scoreSample('buff', 19, 150_000) }
      ],
      readJobScores: async () => [
        {
          contentId: 'michaela-hard',
          jobId: job.jobId,
          jobGrowId: job.jobGrowId,
          ...scoreSample('buff', 25, 160_000)
        }
      ]
    })
  )
  try {
    const { body } = await getJson(origin, '/stats/clears/overview')
    const michaela = body.contents.find(({ id }: { id: string }) => id === 'michaela-hard')
    const challenge = body.contents.find(({ id }: { id: string }) => id === 'engraved-nightmare-1')

    assert.equal(michaela.scores.equipment.median, 900_002)
    assert.equal(michaela.scores.buff, null)
    assert.deepEqual(challenge.scores, noScores)
    const grow = michaela.jobs.find(
      ({ jobGrowId }: { jobGrowId: string }) => jobGrowId === job.jobGrowId
    )
    assert.deepEqual(
      { equipment: grow.scores.equipment, buffMedian: grow.scores.buff.median },
      { equipment: null, buffMedian: 160_002 }
    )
  } finally {
    await app.close()
  }
})

test('상세의 그룹별 점수 분포와 점수 구간은 점수 종류마다 나누어 준다', async () => {
  const { app, origin } = await listen(
    fakeReader({
      readWeekGroups: async () => [groupSample('both', 30, 30)],
      readWeekGroupScores: async () => [
        { group: 'both', ...scoreSample('equipment', 22, 800_000) },
        { group: 'first', ...scoreSample('buff', 21, 140_000) }
      ],
      readScoreBands: async () => [
        { kind: 'buff', score: 140_000, population: 30, cleared: 21 },
        { kind: 'equipment', score: 800_000, population: 50, cleared: 22 }
      ]
    })
  )
  try {
    const { body } = await getJson(origin, '/stats/clears/michaela-hard')

    assert.equal(body.weekOverWeek.both.scores.equipment.median, 800_002)
    assert.equal(body.weekOverWeek.both.scores.buff, null)
    assert.equal(body.weekOverWeek.first.cleared, 0)
    assert.equal(body.weekOverWeek.first.scores.buff.median, 140_002)
    assert.deepEqual(body.scoreBands, {
      equipment: [{ score: 800_000, population: 50, cleared: 22 }],
      buff: [{ score: 140_000, population: 30, cleared: 21 }]
    })
  } finally {
    await app.close()
  }
})
