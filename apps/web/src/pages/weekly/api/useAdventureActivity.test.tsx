// @vitest-environment jsdom
import { HttpResponse, http, type JsonBodyType } from 'msw'
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type {
  ActivitySeason,
  AdventureActivity,
  AdventureActivitySeasonDays
} from '#entities/adventure-guild'
import { API_BASE_URL } from '#shared/api/dfragon-api'
import { server } from '#testing/test-support/msw-server'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import {
  ADVENTURE_ACTIVITY_URL,
  ADVENTURE_BACKFILL_URL,
  ADVENTURE_SEASON_DAYS_URL
} from './adventure.handlers'
import {
  useAdventureActivity,
  useAdventureActivitySeasonDays,
  useBackfillAdventureSeason
} from './useAdventureActivity'

const INVALID_QUERY = '검색 조건을 확인해 주세요.'
const ADVENTURE_URL = `${API_BASE_URL}/adventures/${encodeURIComponent('합성 모험단/1')}`

type Result = Readonly<{ status: string }>

let container: HTMLDivElement
let root: Root
let result: Result
let requested: string[]

beforeEach(() => {
  result = { status: 'loading' }
  requested = []
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

function Harness({ read }: { read: () => Result }): null {
  const value = read()
  useEffect(() => {
    result = value
  })

  return null
}

function respond(url: string, body: JsonBodyType): void {
  server.use(
    http.get(url, ({ request }) => {
      requested.push(`${request.method} ${request.url}`)

      return HttpResponse.json(body)
    })
  )
}

async function settle(read: () => Result): Promise<Result> {
  await act(async () =>
    root.render(
      <TestQueryClient>
        <Harness read={read} />
      </TestQueryClient>
    )
  )
  await vi.waitFor(() => expect(result.status).not.toBe('loading'))

  return result
}

const activity: AdventureActivity = {
  seasons: [
    { id: 9, name: '합성 시즌 9', startsAt: '2023-09-13T21:00:00.000Z', available: false },
    { id: 10, name: '합성 시즌 10', startsAt: '2025-01-08T21:00:00.000Z', available: true }
  ],
  season: {
    id: 10,
    startsAt: '2025-01-08T21:00:00.000Z',
    endsAt: null,
    timelineStartsAt: '2025-01-08T21:00:00.000Z'
  },
  summary: {
    raids: [{ name: '합성 레이드', count: 3, hard: 1, normal: 2 }],
    legions: [],
    items: { legendary: 2, epic: 1, primeval: 0, mythic: 0 },
    oaths: { legendary: 1, epic: 0, primeval: 1 },
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
      highEnhancement: true,
      oath: 2,
      oathPrimeval: true
    }
  ]
}

it('시즌 번호를 season query로, 모험단 이름을 encode한 한 경로 조각으로 담아 시즌 활동을 읽는다', async () => {
  respond(ADVENTURE_ACTIVITY_URL, activity)

  await expect(settle(() => useAdventureActivity('합성 모험단/1', 10))).resolves.toEqual({
    status: 'success',
    value: activity,
    previous: false
  })
  expect(requested).toEqual([`GET ${ADVENTURE_URL}/activity?season=10`])
})

it('시즌을 고르지 않으면 season query 없이 지금 시즌을 읽는다', async () => {
  respond(ADVENTURE_ACTIVITY_URL, activity)

  await settle(() => useAdventureActivity('합성 모험단/1', undefined))

  expect(requested).toEqual([`GET ${ADVENTURE_URL}/activity`])
})

it.each<[string, AdventureActivity]>([
  [
    'DB 설정이 없는 API의 빈 시즌 목록과 null 시즌',
    { ...activity, seasons: [], season: null, days: [] }
  ],
  [
    '레이드 하드, 노말을 보내기 전의 API 응답',
    { ...activity, summary: { ...activity.summary, raids: [{ name: '합성 레이드', count: 3 }] } }
  ]
])('%s도 읽는다', async (_name, body) => {
  respond(ADVENTURE_ACTIVITY_URL, body)

  await expect(settle(() => useAdventureActivity('합성 모험단', undefined))).resolves.toEqual({
    status: 'success',
    value: body,
    previous: false
  })
})

it('빈 이름은 시즌 활동과 하루 상세를 요청하지 않고 검색 조건 문구로 거부한다', async () => {
  await expect(settle(() => useAdventureActivity('  ', 10))).resolves.toEqual({
    status: 'error',
    message: INVALID_QUERY
  })
  await act(async () => root.unmount())
  root = createRoot(container)
  await expect(settle(() => useAdventureActivitySeasonDays('  ', 10))).resolves.toEqual({
    status: 'error',
    message: INVALID_QUERY
  })

  expect(requested).toEqual([])
})

it('모험단 이름과 시즌 번호를 경로에 담아 그 시즌의 하루 활동 상세를 한 번에 읽는다', async () => {
  const seasonDays: AdventureActivitySeasonDays = {
    season: 12,
    days: [
      {
        date: '2026-07-18',
        raids: [{ name: '합성 레이드', count: 2, hard: 0, normal: 2 }],
        legions: [],
        items: [{ at: '2026-07-18T09:58:00+09:00', name: '합성 아이템', rarity: '레전더리' }],
        oaths: [{ at: '2026-07-18T09:59:00+09:00', name: '합성 서약', rarity: '태초' }],
        enhancements: [
          { at: '2026-07-18T10:02:00+09:00', kind: 'amplify', target: 10, success: true }
        ]
      }
    ]
  }
  respond(ADVENTURE_SEASON_DAYS_URL, seasonDays)

  await expect(settle(() => useAdventureActivitySeasonDays('합성 모험단/1', 12))).resolves.toEqual({
    status: 'success',
    value: seasonDays.days
  })
  expect(requested).toEqual([`GET ${ADVENTURE_URL}/activity/seasons/12/days`])
})

it('옛 시즌 받기는 시즌 번호를 경로에 담아 POST로 요청하고, 받은 시즌 상태를 받아 둔 시즌 활동에 넣는다', async () => {
  const running: ActivitySeason = {
    id: 9,
    name: '합성 시즌 9',
    startsAt: '2023-09-13T21:00:00.000Z',
    available: false,
    backfill: { done: 12, total: 30, running: true }
  }
  respond(ADVENTURE_ACTIVITY_URL, activity)
  server.use(
    http.post(ADVENTURE_BACKFILL_URL, ({ request }) => {
      requested.push(`${request.method} ${request.url}`)

      return HttpResponse.json(running)
    })
  )
  let backfill: (seasonId: number) => void = () => {}

  await settle(() => {
    backfill = useBackfillAdventureSeason('합성 모험단/1')

    return useAdventureActivity('합성 모험단/1', 10)
  })
  await act(async () => backfill(9))

  await vi.waitFor(() =>
    expect(result).toMatchObject({
      status: 'success',
      value: { seasons: [running, activity.seasons[1]] }
    })
  )
  expect(requested).toEqual([
    `GET ${ADVENTURE_URL}/activity?season=10`,
    `POST ${ADVENTURE_URL}/activity/seasons/9/backfill`
  ])
})
