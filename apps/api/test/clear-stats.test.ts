import assert from 'node:assert/strict'
import test from 'node:test'
import type {
  ClearJobCount,
  ClearJobFameSample,
  ClearWeekRatioCount,
  ClearWeekSelection,
  StoredClearPopulation
} from '@dfragon/database'
import type { HttpAppHandle } from '../src/runtime/app-handle.js'
import { createCatalogService } from '../src/application/character-catalog/service.js'
import type { ClearStats } from '../src/domain/content-clears/stats.js'
import type { ClearStatsReader } from '../src/application/content-clears/ports.js'
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

function fakeReader(overrides: Partial<ClearStatsReader> = {}): ClearStatsReader {
  return {
    readCollectedAt: async () => at('2026-11-10T06:30:00'),
    readPopulations: async () => populations,
    readWeekRatioCounts: async () => counts,
    readJobCounts: async () => [],
    readAdventureSizes: async () => [],
    readFames: async () => [],
    readJobFames: async () => [],
    readCoClears: async () => [],
    readRaidTimes: async () => [],
    ...overrides
  }
}

async function listen(clearStats?: ClearStatsReader): Promise<{
  app: HttpAppHandle
  origin: string
}> {
  const unused = async (): Promise<never> => assert.fail('Neople을 부르면 안 된다')
  const { app } = await createApiHttpApp({
    search: { searchCharacters: unused },
    details: { fetchDetails: unused, catalog: createCatalogService(unused) },
    todayGrade: { fetchShopGrade: unused },
    clearStats,
    writeAccessLog: () => undefined
  })
  await app.listen(0, '127.0.0.1')

  return { app, origin: await app.getUrl() }
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
      readJobCounts: async (selection) => {
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
  const jobCounts: ClearJobCount[] = [
    { ...job, jobGrowName: '합성전직', cleared: 12 },
    { ...job, jobGrowId: 'synthetic-other', jobGrowName: '합성다른전직', cleared: 2 },
    { jobId: null, jobGrowId: null, jobName: null, jobGrowName: null, cleared: 1 }
  ]
  const adventures = [
    { characters: 1, adventures: 5 },
    { characters: 2, adventures: 5 }
  ]
  const { app, origin } = await listen(
    fakeReader({
      readJobCounts: async () => jobCounts,
      readAdventureSizes: async () => adventures
    })
  )
  try {
    const { status, body } = await getJson(origin, '/stats/clears/michaela-hard?week=2026-11-05')

    assert.equal(status, 200)
    const jobs = [...body.jobs].sort((left, right) => right.cleared - left.cleared)
    assert.deepEqual(jobs, [
      { ...job, jobGrowName: '합성전직', population: 1000, cleared: 12 },
      {
        ...job,
        jobGrowId: 'synthetic-other',
        jobGrowName: '합성다른전직',
        population: 0,
        cleared: 2
      },
      { jobId: null, jobGrowId: null, jobName: null, jobGrowName: null, population: 0, cleared: 1 }
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

    const unknown = await getJson(origin, '/stats/clears/legion-venus')
    assert.equal(unknown.status, 404)
    assert.equal(unknown.body.error.code, 'CHARACTER_NOT_FOUND')
  } finally {
    await app.close()
  }
})

test('클리어 집계는 마지막 수집 시각이 같으면 캐시를 쓰고, 바뀌면 다음 요청부터 새 값을 준다', async () => {
  let collectedAt = at('2026-11-10T06:30:00')
  let cleared = 10
  let reads = 0
  const { app, origin } = await listen(
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
    assert.equal(await michaelaCleared(), 20)
    assert.equal((await getJson(origin, '/stats/clears/michaela-hard')).body.week.cleared, 20)
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
    assert.deepEqual(
      { week: detail.body.week, jobs: detail.body.jobs, adventures: detail.body.adventures },
      { week: null, jobs: [], adventures: [] }
    )
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

test('전체 개요는 마지막 수집 시각이 같으면 다시 읽지 않고, 바뀌면 다음 요청부터 다시 읽는다', async () => {
  let collectedAt = at('2026-11-10T06:30:00')
  let reads = 0
  const { app, origin } = await listen(
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
    assert.equal(await thursdayCleared(), 2)
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
