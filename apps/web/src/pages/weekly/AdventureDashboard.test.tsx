// @vitest-environment jsdom
import { delay, HttpResponse, http } from 'msw'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ActivitySeason, AdventureActivity, AdventureWeekly } from '#entities/adventure-guild'
import { oathCatalogHandlers } from '#entities/catalog/api/oath-catalog.handlers'
import { API_BASE_URL } from '#shared/api/dfragon-api'
import { server } from '#testing/test-support/msw-server'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { TestRouter } from '#testing/test-support/test-router'
import {
  ADVENTURE_ACTIVITY_URL,
  ADVENTURE_BACKFILL_URL,
  ADVENTURE_SEASON_DAYS_URL,
  ADVENTURE_WEEKLY_URL
} from './api/adventure.handlers'
import { WeeklyScreen } from './WeeklyScreen'

const ADVENTURE_PATH = `/adventures/${encodeURIComponent('합성 모험단')}`

let container: HTMLDivElement
let root: Root
let requested: string[]

beforeEach(() => {
  requested = []
  // 주간 던파는 기본으로 끝나지 않고, 시즌 하루 상세는 빈 기록을 돌려준다.
  server.use(
    oathCatalogHandlers.notUploaded,
    http.get(ADVENTURE_WEEKLY_URL, () => delay('infinite')),
    http.get(ADVENTURE_SEASON_DAYS_URL, ({ params }) => {
      const season = Number(params.season)

      return HttpResponse.json({ season, days: [] })
    })
  )
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

const emptySummary: AdventureActivity['summary'] = {
  raids: [],
  legions: [],
  items: { legendary: 0, epic: 0, primeval: 0, mythic: 0 },
  oaths: { legendary: 0, epic: 0, primeval: 0 },
  enhancement: {
    attempts: 0,
    amplify: [],
    reinforce: [],
    amplifyBelow10: 0,
    reinforceBelow12: 0,
    refine: 0
  }
}

const seasons: AdventureActivity['seasons'] = [
  { id: 9, name: '합성 시즌 9', startsAt: '2023-09-13T21:00:00.000Z', available: false },
  { id: 10, name: '합성 시즌 10', startsAt: '2025-01-08T21:00:00.000Z', available: true },
  { id: 11, name: '합성 시즌 11', startsAt: '2026-03-25T21:00:00.000Z', available: true }
]

const currentSeason: AdventureActivity = {
  seasons,
  season: {
    id: 11,
    startsAt: '2026-03-25T21:00:00.000Z',
    endsAt: null,
    timelineStartsAt: '2026-03-25T21:00:00.000Z'
  },
  summary: {
    raids: [
      { name: '가 레이드', count: 1200 },
      { name: '나 레이드', count: 3 }
    ],
    legions: [{ name: '다 레기온', count: 5 }],
    items: { legendary: 7, epic: 4, primeval: 2, mythic: 0 },
    oaths: { legendary: 1, epic: 0, primeval: 0 },
    enhancement: {
      attempts: 40,
      amplify: [
        { target: 10, attempts: 7, successes: 2 },
        { target: 12, attempts: 3, successes: 0 }
      ],
      reinforce: [{ target: 12, attempts: 4, successes: 1 }],
      amplifyBelow10: 20,
      reinforceBelow12: 5,
      refine: 1
    }
  },
  days: []
}

const previousSeason: AdventureActivity = {
  ...currentSeason,
  season: {
    id: 10,
    startsAt: '2025-01-08T21:00:00.000Z',
    endsAt: '2026-03-25T21:00:00.000Z',
    timelineStartsAt: '2025-01-08T21:00:00.000Z'
  },
  summary: { ...emptySummary, raids: [{ name: '라 레이드', count: 9 }] }
}

const emptyWeekly: AdventureWeekly = {
  adventureName: '합성 모험단',
  clearNames: [],
  characters: []
}

type Body<Value> = Value | Response | Promise<Value | Response>

type ActivityReply = (season: number | undefined) => Body<AdventureActivity>

function toResponse(body: AdventureActivity | Response): Response {
  if (body instanceof Response) {
    return body
  }

  return HttpResponse.json(body)
}

function record(request: Request): URL {
  requested.push(`${request.method} ${request.url.slice(API_BASE_URL.length)}`)

  return new URL(request.url)
}

function failure(): Response {
  return HttpResponse.json(
    { error: { code: 'INTERNAL_SERVER_ERROR', message: '합성 활동 오류' } },
    { status: 500 }
  )
}

function respond(activity: Body<AdventureActivity>): ActivityReply {
  return () => activity
}

// 앞의 응답은 한 번씩 쓰고 마지막 응답은 그 뒤 요청에도 계속 쓴다.
function serveActivity(...replies: ActivityReply[]): void {
  server.use(
    ...replies.map((reply, index) =>
      http.get(
        ADVENTURE_ACTIVITY_URL,
        async ({ request }) => {
          const season = record(request).searchParams.get('season')
          const seasonId = season === null ? undefined : Number(season)
          const body = await reply(seasonId)

          return toResponse(body)
        },
        { once: index < replies.length - 1 }
      )
    )
  )
}

function serveBackfill(reply: (season: number) => ActivitySeason): void {
  server.use(
    http.post(ADVENTURE_BACKFILL_URL, ({ params, request }) => {
      record(request)
      const season = Number(params.season)
      const body = reply(season)

      return HttpResponse.json(body)
    })
  )
}

function serveWeekly(weekly: AdventureWeekly): void {
  server.use(http.get(ADVENTURE_WEEKLY_URL, () => HttpResponse.json(weekly)))
}

function activityRequest(season?: number): string {
  const query = season !== undefined ? `?season=${season}` : ''

  return `GET ${ADVENTURE_PATH}/activity${query}`
}

function activityRequests(): string[] {
  return requested.filter((request) => request.startsWith('GET'))
}

function backfillRequests(): string[] {
  return requested.filter((request) => request.startsWith('POST'))
}

function backfillRequest(season: number): string {
  return `POST ${ADVENTURE_PATH}/activity/seasons/${season}/backfill`
}

function render(
  season: number | undefined,
  onSeasonChange: (season: number) => void = vi.fn()
): Promise<void> {
  return act(async () =>
    root.render(
      <TestQueryClient>
        <TestRouter>
          <WeeklyScreen
            adventureName="합성 모험단"
            season={season}
            onSeasonChange={onSeasonChange}
            onAdventureOpen={vi.fn()}
          />
        </TestRouter>
      </TestQueryClient>
    )
  )
}

async function renderSettled(
  season: number | undefined,
  onSeasonChange?: (season: number) => void
): Promise<void> {
  await render(season, onSeasonChange)
  await vi.waitFor(() => expect(heroBusy()).toBe('false'))
}

function refreshButton(name: string): HTMLButtonElement {
  return [...container.querySelectorAll('button')].find((button) => button.textContent === name)!
}

function seasonButton(name: string): HTMLButtonElement {
  return [...container.querySelectorAll<HTMLButtonElement>('nav[aria-label="시즌"] button')].find(
    (button) => button.textContent?.startsWith(name)
  )!
}

function currentSeasonName(): string | undefined {
  const name = container.querySelector('nav[aria-label="시즌"] [aria-current="true"]')?.textContent
  if (name == null) {
    return undefined
  }

  return name
}

function stat(label: string): HTMLElement {
  return [...container.querySelectorAll<HTMLElement>('[tabindex="0"]')].find(
    (element) => element.firstElementChild?.textContent === label
  )!
}

function statValues(): string[] {
  return ['레이드', '레기온', '아이템', '강화'].map(
    (label) => stat(label).lastElementChild?.textContent ?? ''
  )
}

function openPopup(): Element | null {
  return document.querySelector('[data-base-ui-portal] [data-open][data-base-ui-focusable]')
}

function tooltipRows(): string[] {
  return [...(openPopup()?.firstElementChild?.children ?? [])].map((row) => row.textContent ?? '')
}

function hover(element: HTMLElement): void {
  element.dispatchEvent(new MouseEvent('mouseenter'))
}

const FILL_WIDTH_PERCENT_PATTERN = /width: ([\d.]+)%/
const FULL_WIDTH_PATTERN = /width: 100%/

function filledPercent(name: string): number | undefined {
  const style = seasonButton(name).querySelector('i > i')?.getAttribute('style') ?? ''
  const width = FILL_WIDTH_PERCENT_PATTERN.exec(style)?.[1]
  if (width === undefined) {
    return undefined
  }

  return Number(width)
}

function progressText(name: string): string | undefined {
  const last = seasonButton(name).lastElementChild?.textContent ?? ''
  if (!last.endsWith('%')) {
    return undefined
  }

  return last
}

function withBackfill(
  activity: AdventureActivity,
  backfill: NonNullable<AdventureActivity['seasons'][number]['backfill']>,
  available = false
): AdventureActivity {
  return {
    ...activity,
    seasons: activity.seasons.map((season) =>
      season.id === 9 ? { ...season, available, backfill } : season
    )
  }
}

function backfillSeason(activity: AdventureActivity): AdventureActivity['seasons'][number] {
  return activity.seasons.find(({ id }) => id === 9)!
}

function heroBusy(): string | null | undefined {
  return container.querySelector('h1')?.closest('[aria-busy]')?.getAttribute('aria-busy')
}

function summaryLabels(): string[] {
  const hero = container.querySelector('h1')?.closest('[aria-busy]')
  const labels = ['레이드', '레기온', '아이템', '강화']

  return [...(hero?.querySelectorAll('span') ?? [])]
    .map((element) => element.textContent ?? '')
    .filter((text) => labels.includes(text))
}

function primevalLayer(name: string): Element | null {
  return seasonButton(name).querySelector(':scope > i[aria-hidden="true"]')
}

function hasPrimeval(name: string): boolean | undefined {
  const layer = primevalLayer(name)

  if (!(layer instanceof HTMLElement)) {
    return undefined
  }

  return layer.style.opacity === '1'
}

function pending(): Promise<never> {
  return new Promise<never>(() => {})
}

it.each([5, 6, 7, 8, 9, 10, 11])('시즌 %i의 요약은 해당 시즌에 있는 활동만 보인다', async (id) => {
  const selected = {
    ...currentSeason,
    season: { ...currentSeason.season!, id },
    summary: { ...currentSeason.summary, legions: [] }
  }
  serveActivity(respond(selected))
  await renderSettled(id)

  expect(summaryLabels()).toEqual(
    id <= 7 ? ['레이드', '아이템', '강화'] : ['레이드', '레기온', '아이템', '강화']
  )
  const values = [...container.querySelectorAll<HTMLElement>('[tabindex="0"] b')].map(
    (element) => element.textContent
  )
  expect(values).toEqual(id <= 7 ? ['1,203', '14', '40'] : ['1,203', '0', '14', '40'])
})

it.each([7, 8])('시즌 %i를 받는 동안에도 해당 시즌의 요약 라벨을 보인다', async (id) => {
  serveActivity(respond(pending()))
  await render(id)

  expect(heroBusy()).toBe('true')
  expect(summaryLabels()).toEqual(
    id === 7 ? ['레이드', '아이템', '강화'] : ['레이드', '레기온', '아이템', '강화']
  )
})

it('시즌 11에서 시즌 7로 바꾸고 받는 동안 이전 시즌 대신 세 라벨을 보인다', async () => {
  serveActivity(respond(currentSeason), respond(pending()))
  await renderSettled(11)
  await render(7)

  expect(heroBusy()).toBe('true')
  expect(summaryLabels()).toEqual(['레이드', '아이템', '강화'])
})

it('시즌을 고르지 않으면 지금 시즌을 받아 모험단 이름 위에 다른 글자 없이 시즌 이름, 시작일과 요약 숫자 4개를 보인다', async () => {
  vi.useFakeTimers({ toFake: ['Date'], now: Date.parse('2026-11-08T03:00:00.000Z') })
  try {
    serveActivity(respond(currentSeason))
    await renderSettled(undefined)

    expect(activityRequests()).toEqual([activityRequest()])
    expect(container.querySelector('h1')?.textContent).toBe('합성 모험단')
    expect(container.querySelector('h1')?.parentElement?.textContent).toBe('합성 모험단')
    expect(currentSeasonName()).toBe('합성 시즌 11')
    expect(container.textContent).toContain('시즌 11합성 시즌 11228일2026.03.26 ~')
    expect(statValues()).toEqual(['1,203', '5', '14', '40'])
  } finally {
    vi.useRealTimers()
  }
})

it('시즌을 누르면 그 시즌 번호를 알리고, 바뀐 시즌을 받는 동안 시즌 목록과 고른 시즌을 그대로 보인 뒤 새 요약을 그린다', async () => {
  const onSeasonChange = vi.fn()
  const loaded = Promise.withResolvers<AdventureActivity>()
  serveActivity(respond(currentSeason), respond(loaded.promise))
  await renderSettled(undefined, onSeasonChange)

  await act(async () => seasonButton('합성 시즌 11').click())
  expect(onSeasonChange).not.toHaveBeenCalled()
  await act(async () => seasonButton('합성 시즌 10').click())
  expect(onSeasonChange).toHaveBeenCalledWith(10)

  await render(10, onSeasonChange)
  await vi.waitFor(() => expect(activityRequests().at(-1)).toBe(activityRequest(10)))
  expect(currentSeasonName()).toBe('합성 시즌 10')
  expect(container.textContent).toContain('시즌 10합성 시즌 10441일2025.01.09 ~ 2026.03.25')
  expect(heroBusy()).toBe('true')
  expect(container.querySelectorAll('[tabindex="0"]')).toHaveLength(0)

  loaded.resolve(previousSeason)
  await vi.waitFor(() => expect(heroBusy()).toBe('false'))
  expect(statValues()).toEqual(['9', '0', '0', '0'])
})

it('타임라인 수집 전 시즌은 누를 수 없고 눌러도 시즌을 바꾸지 않는다', async () => {
  const onSeasonChange = vi.fn()
  serveActivity(respond(currentSeason))
  await renderSettled(undefined, onSeasonChange)

  const before = seasonButton('합성 시즌 9')
  expect(before.disabled).toBe(true)
  expect(seasonButton('합성 시즌 10').disabled).toBe(false)
  await act(async () => before.click())

  expect(onSeasonChange).not.toHaveBeenCalled()
  expect(currentSeasonName()).toBe('합성 시즌 11')
})

it('받기 전 옛 시즌을 누르면 그 시즌 받기를 요청하고 고른 시즌은 그대로 둔 채 받은 만큼 막대를 채운다', async () => {
  const onSeasonChange = vi.fn()
  const running = withBackfill(currentSeason, { done: 12, total: 30, running: true })
  serveActivity(respond(withBackfill(currentSeason, { done: 0, total: 30, running: false })))
  serveBackfill(() => backfillSeason(running))
  await renderSettled(undefined, onSeasonChange)
  expect(seasonButton('합성 시즌 9').disabled).toBe(false)
  expect(filledPercent('합성 시즌 9')).toBe(0)

  await act(async () => seasonButton('합성 시즌 9').click())
  await vi.waitFor(() => expect(filledPercent('합성 시즌 9')).toBe(40))

  expect(backfillRequests()).toEqual([backfillRequest(9)])
  expect(onSeasonChange).not.toHaveBeenCalled()
  expect(currentSeasonName()).toBe('합성 시즌 11')
  expect(progressText('합성 시즌 9')).toBe('40%')
  expect(seasonButton('합성 시즌 9').getAttribute('aria-busy')).toBe('true')

  // 두 번째 받기 요청이 나갔다면 MSW에 닿을 틈을 준 뒤 센다.
  await act(async () => seasonButton('합성 시즌 9').click())
  await act(async () => delay(50))
  expect(backfillRequests()).toHaveLength(1)
})

it('받는 동안 시즌 활동을 다시 조회해 막대를 늘리고, 다 받으면 조회를 멈추고 그 시즌을 고를 수 있다', async () => {
  vi.useFakeTimers()
  try {
    const onSeasonChange = vi.fn()
    serveActivity(
      respond(withBackfill(currentSeason, { done: 6, total: 30, running: true })),
      respond(withBackfill(currentSeason, { done: 24, total: 30, running: true })),
      respond(withBackfill(currentSeason, { done: 30, total: 30, running: false }, true))
    )
    await renderSettled(undefined, onSeasonChange)
    expect(filledPercent('합성 시즌 9')).toBe(20)

    await act(async () => vi.advanceTimersByTimeAsync(3000))
    await vi.waitFor(() => expect(filledPercent('합성 시즌 9')).toBe(80))

    await act(async () => vi.advanceTimersByTimeAsync(3000))
    await vi.waitFor(() => expect(progressText('합성 시즌 9')).toBeUndefined())
    expect(filledPercent('합성 시즌 9')).toBeUndefined()
    expect(seasonButton('합성 시즌 9').getAttribute('aria-busy')).toBeNull()

    const calls = activityRequests().length
    await act(async () => vi.advanceTimersByTimeAsync(30_000))
    expect(activityRequests()).toHaveLength(calls)

    await act(async () => seasonButton('합성 시즌 9').click())
    expect(onSeasonChange).toHaveBeenCalledWith(9)
  } finally {
    vi.useRealTimers()
  }
})

it('받다 멈춘 옛 시즌은 받은 만큼 채운 막대를 그대로 보이고, 다시 누르면 이어 받기를 요청하고 진행을 다시 조회한다', async () => {
  vi.useFakeTimers()
  try {
    const onSeasonChange = vi.fn()
    serveActivity(
      respond(withBackfill(currentSeason, { done: 12, total: 30, running: false })),
      respond(withBackfill(currentSeason, { done: 18, total: 30, running: true }))
    )
    serveBackfill(() =>
      backfillSeason(withBackfill(currentSeason, { done: 12, total: 30, running: true }))
    )
    await renderSettled(undefined, onSeasonChange)
    expect(filledPercent('합성 시즌 9')).toBe(40)
    expect(seasonButton('합성 시즌 9').getAttribute('aria-busy')).toBeNull()

    await act(async () => vi.advanceTimersByTimeAsync(30_000))
    expect(activityRequests()).toHaveLength(1)

    await act(async () => seasonButton('합성 시즌 9').click())
    await vi.waitFor(() =>
      expect(seasonButton('합성 시즌 9').getAttribute('aria-busy')).toBe('true')
    )
    expect(backfillRequests()).toEqual([backfillRequest(9)])
    expect(onSeasonChange).not.toHaveBeenCalled()

    await act(async () => vi.advanceTimersByTimeAsync(3000))
    await vi.waitFor(() => expect(filledPercent('합성 시즌 9')).toBe(60))
    expect(activityRequests()).toHaveLength(2)
  } finally {
    vi.useRealTimers()
  }
})

it('받는 중에 받아 둔 다른 시즌으로 바꿔도 그 시즌 응답으로 진행 조회를 이어 간다', async () => {
  vi.useFakeTimers()
  try {
    let backfill = { done: 12, total: 30, running: false }
    serveActivity((season) =>
      withBackfill(season === 10 ? previousSeason : currentSeason, backfill)
    )
    serveBackfill(() => {
      backfill = { done: 12, total: 30, running: true }

      return backfillSeason(withBackfill(currentSeason, backfill))
    })
    await renderSettled(10)
    await renderSettled(11)
    await act(async () => seasonButton('합성 시즌 9').click())
    await vi.waitFor(() =>
      expect(seasonButton('합성 시즌 9').getAttribute('aria-busy')).toBe('true')
    )

    backfill = { done: 18, total: 30, running: true }
    await render(10)
    expect(activityRequests()).toHaveLength(2)

    await act(async () => vi.advanceTimersByTimeAsync(3000))
    await vi.waitFor(() => expect(filledPercent('합성 시즌 9')).toBe(60))
    expect(activityRequests().at(-1)).toBe(activityRequest(10))
  } finally {
    vi.useRealTimers()
  }
})

it('받기가 끝난 뒤 받아 둔 다른 시즌으로 돌아가도 완료된 막대를 유지한다', async () => {
  vi.useFakeTimers()
  try {
    let backfill = { done: 12, total: 30, running: false }
    let available = false
    serveActivity((season) =>
      withBackfill(season === 10 ? previousSeason : currentSeason, backfill, available)
    )
    serveBackfill(() => {
      backfill = { done: 12, total: 30, running: true }

      return backfillSeason(withBackfill(currentSeason, backfill))
    })
    await renderSettled(10)
    await renderSettled(11)
    await act(async () => seasonButton('합성 시즌 9').click())
    await vi.waitFor(() => expect(hasPrimeval('합성 시즌 9')).toBe(true))

    backfill = { done: 30, total: 30, running: false }
    available = true
    await act(async () => vi.advanceTimersByTimeAsync(3000))
    await vi.waitFor(() => expect(hasPrimeval('합성 시즌 9')).toBe(false))
    expect(seasonButton('합성 시즌 9').getAttribute('aria-busy')).toBeNull()

    await render(10)
    expect(activityRequests()).toHaveLength(3)
    expect(statValues()).toEqual(['9', '0', '0', '0'])
    expect(seasonButton('합성 시즌 9').getAttribute('aria-busy')).toBeNull()
    expect(hasPrimeval('합성 시즌 9')).toBe(false)
  } finally {
    vi.useRealTimers()
  }
})

it('옛 시즌 둘을 받으며 시즌을 오가도 완료된 막대가 다시 받는 중으로 돌아가지 않는다', async () => {
  vi.useFakeTimers()
  try {
    const backfills = {
      8: { done: 0, total: 30, running: false },
      9: { done: 0, total: 30, running: false }
    }
    function activity(season: number | undefined): AdventureActivity {
      const selected = season === 10 ? previousSeason : currentSeason
      const oldSeasons = [
        { id: 8, name: '합성 시즌 8', startsAt: '2021-01-01T00:00:00.000Z', available: false },
        ...selected.seasons
      ]

      return {
        ...selected,
        seasons: oldSeasons.map((entry) => {
          if (entry.id !== 8 && entry.id !== 9) {
            return entry
          }

          const backfill = backfills[entry.id]
          const available = backfill.done === backfill.total

          return { ...entry, available, backfill }
        })
      }
    }
    serveActivity(activity)
    serveBackfill((id) => {
      if (id === 8 || id === 9) {
        backfills[id] = { ...backfills[id], running: true }
      }

      return activity(11).seasons.find((entry) => entry.id === id)!
    })
    await renderSettled(10)
    await renderSettled(11)
    for (const name of ['합성 시즌 8', '합성 시즌 9']) {
      await act(async () => seasonButton(name).click())
      await vi.waitFor(() => expect(seasonButton(name).getAttribute('aria-busy')).toBe('true'))
    }
    await render(10)

    backfills[8] = { done: 30, total: 30, running: false }
    backfills[9] = { done: 18, total: 30, running: true }
    await act(async () => vi.advanceTimersByTimeAsync(3000))
    await vi.waitFor(() => expect(filledPercent('합성 시즌 9')).toBe(60))
    await render(11)
    expect(seasonButton('합성 시즌 8').getAttribute('aria-busy')).toBeNull()
    expect(hasPrimeval('합성 시즌 8')).toBe(false)
    expect(seasonButton('합성 시즌 9').getAttribute('aria-busy')).toBe('true')
    expect(filledPercent('합성 시즌 9')).toBe(60)

    backfills[9] = { done: 30, total: 30, running: false }
    await act(async () => vi.advanceTimersByTimeAsync(3000))
    await vi.waitFor(() => expect(seasonButton('합성 시즌 9').getAttribute('aria-busy')).toBeNull())
    await render(10)
    expect(statValues()).toEqual(['9', '0', '0', '0'])
    for (const name of ['합성 시즌 8', '합성 시즌 9']) {
      expect(seasonButton(name).getAttribute('aria-busy')).toBeNull()
      expect(hasPrimeval(name)).toBe(false)
    }
    expect(backfillRequests()).toEqual([backfillRequest(8), backfillRequest(9)])
  } finally {
    vi.useRealTimers()
  }
})

it('요약 숫자에 키보드 focus를 주면 내역이 열리고, 강화는 높은 단계부터 증폭, 강화 순 성공/시도 뒤에 나머지 횟수를 보인다', async () => {
  serveActivity(respond(currentSeason))
  await renderSettled(undefined)

  await act(async () => stat('레이드').focus())
  expect(tooltipRows()).toEqual(['가 레이드1,200회', '나 레이드3회'])

  await act(async () => stat('아이템').focus())
  expect(tooltipRows()).toEqual([
    '장비13',
    '레전더리7개',
    '에픽4개',
    '태초2개',
    '',
    '서약1',
    '레전더리1개'
  ])

  await act(async () => stat('강화').focus())
  expect(tooltipRows()).toEqual([
    '증폭',
    '+12(0/3 0%)',
    '+10(2/7 29%)',
    '강화',
    '+12(1/4 25%)',
    '',
    '10증폭 미만20회',
    '12강 미만5회',
    '재련1회'
  ])
})

it('시즌 9의 아이템 내역은 신화까지 등급별 수 한 묶음으로 두고 개수가 0인 등급 줄을 뺀다', async () => {
  const items = { legendary: 7, epic: 0, primeval: 2, mythic: 1 }
  serveActivity(
    respond({
      ...currentSeason,
      season: { ...currentSeason.season!, id: 9 },
      summary: { ...emptySummary, items }
    })
  )
  await renderSettled(undefined)

  expect(stat('아이템').lastElementChild?.textContent).toBe('10')
  await act(async () => stat('아이템').focus())

  expect(tooltipRows()).toEqual(['레전더리7개', '태초2개', '신화1개'])
})

it('시즌 10의 아이템 숫자는 장비와 서약을 더하고, 내역은 수가 0인 묶음과 등급 줄을 뺀다', async () => {
  const withSummary = (summary: Partial<AdventureActivity['summary']>) =>
    respond({ ...previousSeason, summary: { ...emptySummary, ...summary } })
  serveActivity(
    withSummary({
      items: { legendary: 3, epic: 0, primeval: 1, mythic: 0 },
      oaths: { legendary: 0, epic: 2, primeval: 1 }
    })
  )
  await renderSettled(10)
  expect(stat('아이템').lastElementChild?.textContent).toBe('7')
  await act(async () => stat('아이템').focus())
  expect(tooltipRows()).toEqual([
    '장비4',
    '레전더리3개',
    '태초1개',
    '',
    '서약3',
    '에픽2개',
    '태초1개'
  ])

  await act(async () => root.unmount())
  root = createRoot(container)
  serveActivity(withSummary({ oaths: { legendary: 2, epic: 0, primeval: 0 } }))
  await renderSettled(10)
  await act(async () => stat('아이템').focus())
  expect(tooltipRows()).toEqual(['서약2', '레전더리2개'])
})

it('요약 숫자에 마우스를 올리면 내역이 열리고, 0인 숫자는 내역을 열지 않는다', async () => {
  serveActivity(respond({ ...currentSeason, summary: { ...currentSeason.summary, legions: [] } }))
  await renderSettled(undefined)

  await act(async () => hover(stat('레기온')))
  expect(openPopup()).toBeNull()

  await act(async () => hover(stat('레이드')))
  expect(tooltipRows()).toEqual(['가 레이드1,200회', '나 레이드3회'])
})

it('갱신을 누르면 다시 받는 동안 받아 둔 시즌 활동을 그대로 두고, 같은 시즌을 다시 받으면 새 응답으로 그리고 갱신 버튼은 꺼 둔다', async () => {
  const refreshed = Promise.withResolvers<AdventureActivity>()
  serveActivity(respond(previousSeason), respond(refreshed.promise))
  serveWeekly(emptyWeekly)
  await renderSettled(10)
  expect(statValues()[0]).toBe('9')

  await act(async () => refreshButton('갱신').click())
  expect(refreshButton('받는 중').disabled).toBe(true)
  expect(heroBusy()).toBe('false')
  expect(statValues()[0]).toBe('9')

  refreshed.resolve({
    ...previousSeason,
    summary: { ...previousSeason.summary, raids: [{ name: '라 레이드', count: 12 }] }
  })
  await vi.waitFor(() => expect(refreshButton('갱신').disabled).toBe(true))
  expect(activityRequests()).toEqual([activityRequest(10), activityRequest(10)])
  expect(statValues()[0]).toBe('12')
})

it('갱신이 실패하면 오류 문구 없이 받아 둔 시즌 활동을 둔다', async () => {
  serveActivity(respond(previousSeason), respond(failure()))
  serveWeekly(emptyWeekly)
  await renderSettled(10)

  await act(async () => refreshButton('갱신').click())
  await vi.waitFor(() => {
    expect(activityRequests()).toHaveLength(2)
    expect(refreshButton('갱신')?.disabled).toBe(true)
  })

  expect(container.querySelector('[role="alert"]')).toBeNull()
  expect(statValues()[0]).toBe('9')
})

it('레이드 내역은 하드와 노말이 모두 있으면 둘을 나눠 보이고, 한쪽만 있거나 없는 응답은 합계만 응답 순서대로 보인다', async () => {
  const raids = [
    { name: '가 레이드', count: 55, hard: 24, normal: 31 },
    { name: '나 레이드', count: 3, hard: 3, normal: 0 },
    { name: '다 레이드', count: 7 }
  ]
  serveActivity(respond({ ...currentSeason, summary: { ...currentSeason.summary, raids } }))
  await renderSettled(undefined)

  await act(async () => stat('레이드').focus())

  expect(tooltipRows()).toEqual(['가 레이드하드 24회 | 노말 31회', '나 레이드3회', '다 레이드7회'])
})

it.each([
  ['받는 중', { done: 12, total: 30, running: true }, false, true],
  ['멈춤', { done: 12, total: 30, running: false }, false, false],
  ['완료', { done: 30, total: 30, running: false }, true, false]
])(
  '옛 시즌 막대는 받는 중일 때만 태초색으로 채우고 테두리는 두지 않는다: %s',
  async (_, backfill, available, primeval) => {
    serveActivity(respond(withBackfill(currentSeason, backfill, available)))
    await renderSettled(undefined)

    expect(hasPrimeval('합성 시즌 9')).toBe(primeval)
    expect(seasonButton('합성 시즌 9').querySelectorAll('i[aria-hidden="true"]')).toHaveLength(1)
  }
)

it('받기가 끝나도 같은 태초색 층이 남아 막대 끝까지 채우고 태초색을 끈다', async () => {
  vi.useFakeTimers()
  try {
    serveActivity(
      respond(withBackfill(currentSeason, { done: 24, total: 30, running: true })),
      respond(withBackfill(currentSeason, { done: 30, total: 30, running: false }, true))
    )
    await renderSettled(undefined)
    const layer = primevalLayer('합성 시즌 9')
    expect(hasPrimeval('합성 시즌 9')).toBe(true)

    await act(async () => vi.advanceTimersByTimeAsync(3000))
    await vi.waitFor(() => expect(hasPrimeval('합성 시즌 9')).toBe(false))

    expect(primevalLayer('합성 시즌 9')).toBe(layer)
    expect(layer?.getAttribute('style')).toMatch(FULL_WIDTH_PATTERN)
  } finally {
    vi.useRealTimers()
  }
})
