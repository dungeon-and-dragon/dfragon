import { expect, it, vi } from 'vitest'
import type { AdventureActivity, AdventureActivityDay } from '../adventure-guild/adventure-activity'
import { createDfragonClient } from './dfragon-client'

const API_ORIGIN = 'https://api.example.test'

function respond(body: unknown) {
  return vi.fn<typeof globalThis.fetch>(async () => new Response(JSON.stringify(body)))
}

const activity: AdventureActivity = {
  seasons: [
    { id: 9, name: '합성 시즌 9', startsAt: '2023-09-13T21:00:00.000Z', available: false },
    { id: 10, name: '합성 시즌 10', startsAt: '2025-01-08T21:00:00.000Z', available: true }
  ],
  season: { id: 10, startsAt: '2025-01-08T21:00:00.000Z', endsAt: null },
  summary: {
    raids: [{ name: '합성 레이드', count: 3 }],
    legions: [],
    items: { legendary: 2, epic: 1, primeval: 0, mythic: 0 },
    enhancement: {
      attempts: 4,
      amplify: [{ target: 10, attempts: 1, successes: 0 }],
      reinforce: [],
      amplifyBelow10: 2,
      reinforceBelow12: 1,
      refine: 0
    }
  },
  days: [
    {
      date: '2025-01-09',
      raid: 3,
      legion: 0,
      item: 3,
      enhance: 4,
      primeval: false,
      mythic: false,
      highEnhancement: true
    }
  ]
}

function requestedUrl(fetch: ReturnType<typeof respond>): string {
  return new Request(fetch.mock.calls[0][0]).url
}

it('시즌 번호를 season query로 담아 모험단 시즌 활동을 읽는다', async () => {
  const fetch = respond(activity)
  const read = createDfragonClient({ apiOrigin: API_ORIGIN, fetch }).adventures.activity

  await expect(read('합성 모험단/1', 10)).resolves.toEqual(activity)
  expect(requestedUrl(fetch)).toBe(
    `${API_ORIGIN}/adventures/${encodeURIComponent('합성 모험단/1')}/activity?season=10`
  )
})

it('시즌을 고르지 않으면 season query 없이 지금 시즌을 읽는다', async () => {
  const fetch = respond(activity)
  const read = createDfragonClient({ apiOrigin: API_ORIGIN, fetch }).adventures.activity

  await read('합성 모험단', undefined)

  expect(requestedUrl(fetch)).toBe(
    `${API_ORIGIN}/adventures/${encodeURIComponent('합성 모험단')}/activity`
  )
})

it('DB 설정이 없는 API의 빈 시즌 목록과 null 시즌도 읽는다', async () => {
  const empty = { ...activity, seasons: [], season: null, days: [] }
  const read = createDfragonClient({ apiOrigin: API_ORIGIN, fetch: respond(empty) }).adventures
    .activity

  await expect(read('합성 모험단', undefined)).resolves.toEqual(empty)
})

it('빈 이름은 요청하지 않고 거부한다', async () => {
  const fetch = respond(activity)
  const read = createDfragonClient({ apiOrigin: API_ORIGIN, fetch }).adventures.activity

  await expect(read('  ', 10)).rejects.toMatchObject({ code: 'INVALID_SEARCH_QUERY' })
  expect(fetch).not.toHaveBeenCalled()
})

const day: AdventureActivityDay = {
  date: '2026-07-18',
  raids: [{ name: '합성 레이드', count: 2 }],
  legions: [],
  items: [{ at: '2026-07-18T09:58:00+09:00', name: '합성 아이템', rarity: '레전더리' }],
  enhancements: [{ at: '2026-07-18T10:02:00+09:00', kind: 'amplify', target: 10, success: true }]
}

it('모험단 이름과 날짜를 경로에 담아 하루 활동 상세를 읽는다', async () => {
  const fetch = respond(day)
  const read = createDfragonClient({ apiOrigin: API_ORIGIN, fetch }).adventures.activityDay

  await expect(read('합성 모험단/1', '2026-07-18')).resolves.toEqual(day)
  expect(requestedUrl(fetch)).toBe(
    `${API_ORIGIN}/adventures/${encodeURIComponent('합성 모험단/1')}/activity/days/2026-07-18`
  )
})
