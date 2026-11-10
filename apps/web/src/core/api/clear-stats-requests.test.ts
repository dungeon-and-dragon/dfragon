import { expect, it, vi } from 'vitest'
import type { ClearContentStats, ClearStats, ClearWeek } from '../ranking/clear-stats'
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
      cleared: 28
    },
    {
      jobId: null,
      jobGrowId: null,
      jobName: null,
      jobGrowName: null,
      population: 0,
      cleared: 2
    }
  ],
  adventures: [
    { characters: 1, adventures: 20 },
    { characters: 2, adventures: 5 }
  ]
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

it('수집한 주가 없는 컨텐츠 집계는 week null과 빈 목록으로 읽는다', async () => {
  const empty = { ...detail, week: null, jobs: [], adventures: [] }

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
