import { expect, it, vi } from 'vitest'
import type {
  ClearContentStats,
  ClearOverview,
  ClearStats,
  ClearWeek
} from '../ranking/clear-stats'
import { createDfragonClient } from './dfragon-client'

const API_ORIGIN = 'https://api.example.test'

function respond(body: unknown, status = 200) {
  return vi.fn<typeof globalThis.fetch>(async () => new Response(JSON.stringify(body), { status }))
}

const week: ClearWeek = {
  weekStart: '2026-11-05',
  closed: false,
  collectedAt: '2026-11-09T20:12:00.000Z',
  population: 100000,
  minFame: 125871,
  cleared: 30,
  newlyCleared: null,
  ratios: [
    { ratio: null, cleared: 20 },
    { ratio: 50, cleared: 10 }
  ]
}

const summary: ClearStats = {
  contents: [
    {
      id: 'michaela-hard',
      kind: 'raid',
      name: '무너진 성자 미카엘라 (하드)',
      releasedAt: '2026-08-05T21:00:00.000Z',
      entryFame: 104292,
      latest: true,
      weeks: [week]
    },
    {
      id: 'nabel-normal',
      kind: 'raid',
      name: '만들어진 신 나벨 (일반)',
      releasedAt: '2025-04-16T21:00:00.000Z',
      entryFame: 104292,
      latest: false,
      weeks: []
    }
  ]
}

const detail: ClearContentStats = {
  id: 'michaela-hard',
  kind: 'raid',
  name: '무너진 성자 미카엘라 (하드)',
  releasedAt: '2026-08-05T21:00:00.000Z',
  entryFame: 104292,
  latest: true,
  week,
  jobs: [
    {
      jobId: 'job-1',
      jobGrowId: 'grow-1',
      jobName: '합성 직업',
      jobGrowName: '眞 합성 전직',
      population: 100,
      cleared: 28,
      fame: { p5: 110000, p25: 118000, median: 122000, p75: 126000, p95: 132000, max: 140000 }
    },
    {
      jobId: null,
      jobGrowId: null,
      jobName: null,
      jobGrowName: null,
      population: 0,
      cleared: 2,
      fame: null
    }
  ],
  adventures: [
    { characters: 1, adventures: 20 },
    { characters: 2, adventures: 5 }
  ],
  weeklyClears: [
    {
      weekStart: '2026-11-05',
      population: 100000,
      firstCleared: 10,
      repeatCleared: 20,
      everCleared: 40
    }
  ],
  fameBands: [{ fame: 104000, population: 500, cleared: 30 }],
  weekOverWeek: {
    both: { cleared: 15, fame: null },
    returned: { cleared: 3, fame: null },
    left: { cleared: 4, fame: null },
    first: { cleared: 10, fame: null }
  },
  stageMoves: {
    hard: { same: 15, other: 3, none: 12 },
    normal: { same: 40, other: 2, none: 8 }
  },
  streaks: [{ weeks: 1, characters: 30 }],
  weekdays: [{ weekday: 6, cleared: 30 }],
  hours: [{ hour: 21, cleared: 30 }]
}

it('클리어 집계 목록 응답을 읽는다', async () => {
  const fetch = respond(summary)

  await expect(createDfragonClient({ apiOrigin: API_ORIGIN, fetch }).clearStats()).resolves.toEqual(
    summary
  )
  expect(new Request(fetch.mock.calls[0][0]).url).toBe(`${API_ORIGIN}/stats/clears`)
})

it('컨텐츠 집계는 고른 주를 week query로 보내고, 주를 고르지 않으면 query 없이 부른다', async () => {
  const fetch = respond(detail)
  const read = createDfragonClient({ apiOrigin: API_ORIGIN, fetch }).clearContentStats

  await expect(read('michaela-hard', '2026-11-05')).resolves.toEqual(detail)
  expect(new Request(fetch.mock.calls[0][0]).url).toBe(
    `${API_ORIGIN}/stats/clears/michaela-hard?week=2026-11-05`
  )
  await read('michaela-hard', undefined)
  expect(new Request(fetch.mock.calls[1][0]).url).toBe(`${API_ORIGIN}/stats/clears/michaela-hard`)
})

it('수집한 주가 없거나 챌린지인 컨텐츠 집계는 week와 레이드 전용 통계를 null로 읽는다', async () => {
  const empty = {
    ...detail,
    kind: 'challenge',
    week: null,
    jobs: [],
    adventures: [],
    weeklyClears: [],
    fameBands: [],
    weekOverWeek: null,
    stageMoves: null,
    streaks: null,
    weekdays: [],
    hours: []
  }

  await expect(
    createDfragonClient({ apiOrigin: API_ORIGIN, fetch: respond(empty) }).clearContentStats(
      'michaela-hard',
      undefined
    )
  ).resolves.toEqual(empty)
})

it('모르는 종류나 날짜가 아닌 주, 0명 모험단이 있는 응답은 거부한다', async () => {
  const content = summary.contents[0]
  const responses = [
    { contents: [{ ...content, kind: 'legion' }] },
    { contents: [{ ...content, weeks: [{ ...week, weekStart: '2026-11-05T00:00:00.000Z' }] }] }
  ]
  for (const body of responses) {
    await expect(
      createDfragonClient({ apiOrigin: API_ORIGIN, fetch: respond(body) }).clearStats()
    ).rejects.toThrow()
  }

  await expect(
    createDfragonClient({
      apiOrigin: API_ORIGIN,
      fetch: respond({ ...detail, adventures: [{ characters: 0, adventures: 1 }] })
    }).clearContentStats('michaela-hard', undefined)
  ).rejects.toThrow()
})

const fame = { p5: 110000, p25: 118000, median: 122000, p75: 126000, p95: 132000, max: 140000 }

const overview: ClearOverview = {
  weekStart: '2026-11-05',
  contents: [
    {
      id: 'michaela-hard',
      cleared: 30,
      fame,
      jobs: [
        {
          jobId: 'job-1',
          jobGrowId: 'grow-1',
          jobName: '합성 직업',
          jobGrowName: '眞 합성 전직',
          population: 100,
          cleared: 28,
          fame: null
        }
      ],
      coClears: [{ id: 'michaela-normal', cleared: 4 }]
    }
  ],
  weekdays: [{ weekday: 6, cleared: 30 }],
  hours: [{ hour: 21, cleared: 30 }]
}

it('전체 개요는 고른 주를 week query로 보내 컨텐츠별 분포와 요일, 시간대 클리어 수를 읽는다', async () => {
  const fetch = respond(overview)

  await expect(
    createDfragonClient({ apiOrigin: API_ORIGIN, fetch }).clearOverview('2026-11-05')
  ).resolves.toEqual(overview)
  expect(new Request(fetch.mock.calls[0][0]).url).toBe(
    `${API_ORIGIN}/stats/clears/overview?week=2026-11-05`
  )
})

it('요일이 1부터 7 밖이거나 분포 값이 빠진 전체 개요 응답은 거부한다', async () => {
  const responses = [
    { ...overview, weekdays: [{ weekday: 0, cleared: 30 }] },
    { ...overview, contents: [{ ...overview.contents[0], fame: { median: 122000 } }] }
  ]
  for (const body of responses) {
    await expect(
      createDfragonClient({ apiOrigin: API_ORIGIN, fetch: respond(body) }).clearOverview(
        '2026-11-05'
      )
    ).rejects.toThrow()
  }
})
