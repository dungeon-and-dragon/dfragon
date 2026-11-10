import assert from 'node:assert/strict'
import test from 'node:test'
import type {
  ClearJobCount,
  ClearWeekRatioCount,
  ClearWeekSelection,
  StoredClearPopulation
} from '@dfragon/database'
import type { INestApplication } from '@nestjs/common'
import { createCatalogService } from '../src/application/character-catalog/service.js'
import type { ClearStats, ClearStatsReader } from '../src/content-clears/stats.js'
import { createApiHttpApp } from '../src/http.js'

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
    ...overrides
  }
}

async function listen(clearStats?: ClearStatsReader): Promise<{
  app: INestApplication
  origin: string
}> {
  const unused = async (): Promise<never> => assert.fail('Neople을 부르면 안 된다')
  const app = await createApiHttpApp({
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
