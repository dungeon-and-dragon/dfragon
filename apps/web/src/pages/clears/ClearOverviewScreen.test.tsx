// @vitest-environment jsdom
import { HttpResponse, http } from 'msw'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type {
  ClearContent,
  ClearContentStats,
  ClearOverview,
  ClearOverviewJob,
  ClearStats,
  ClearWeek
} from '#entities/ranking'
import { API_BASE_URL } from '#shared/api/dfragon-api'
import { server } from '#testing/test-support/msw-server'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { CLEAR_CONTENT_STATS_URL, CLEAR_OVERVIEW_URL, CLEAR_STATS_URL } from './api/clears.handlers'
import { ClearOverviewScreen } from './ClearOverviewScreen'

let container: HTMLDivElement
let root: Root
let requested: string[]

beforeEach(() => {
  requested = []
  // 2026-11-14 14:00 KST. 타이머는 그대로 두고 지금 시각만 고정한다.
  vi.useFakeTimers({ now: new Date('2026-11-14T05:00:00.000Z'), toFake: ['Date'] })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
})

const DAY = 24 * 60 * 60 * 1000
const LATEST_WEEK = '2026-11-12'
const LAST_CLOSED_WEEK = '2026-11-05'

function weekStartBefore(weeks: number): string {
  return new Date(Date.parse(`${LATEST_WEEK}T00:00:00Z`) - weeks * 7 * DAY)
    .toISOString()
    .slice(0, 10)
}

function week(weekStart: string, cleared: number, population = 1000): ClearWeek {
  return {
    weekStart,
    closed: weekStart !== LATEST_WEEK,
    population,
    minFame: 104292,
    cleared,
    newlyCleared: null,
    ratios: [{ ratio: null, cleared }]
  }
}

// 가장 최근 주부터 거꾸로 셋째 주까지 이번 주, 지난주, 그 전 주의 클리어 수를 준다.
function recentWeeks(counts: readonly number[], population = 1000): ClearWeek[] {
  return counts
    .map((cleared, index) => week(weekStartBefore(index), cleared, population))
    .toReversed()
}

function content(
  id: string,
  kind: ClearContent['kind'],
  name: string,
  releasedAt: string,
  weeks: ClearWeek[]
): ClearContent {
  return { id, kind, name, releasedAt, entryFame: 104292, latest: true, weeks }
}

const michaelaHard = content(
  'michaela-hard',
  'raid',
  '무너진 성자 미카엘라 (하드)',
  '2026-08-05T21:00:00.000Z',
  recentWeeks([60, 57, 61])
)
const michaelaNormal = content(
  'michaela-normal',
  'raid',
  '무너진 성자 미카엘라 (일반)',
  '2026-08-05T21:00:00.000Z',
  recentWeeks([100, 106, 106])
)
const diregieHard = content(
  'diregie-hard',
  'raid',
  '디레지에 레이드 (하드)',
  '2026-02-04T21:00:00.000Z',
  Array.from({ length: 10 }, (_, index) => week(weekStartBefore(25 - index), 300))
)
const nabelHard = content(
  'nabel-hard',
  'raid',
  '만들어진 신 나벨 (하드)',
  '2025-04-16T21:00:00.000Z',
  Array.from({ length: 30 }, (_, index) => week(weekStartBefore(29 - index), 40))
)
const nightmare = content(
  'engraved-nightmare-1',
  'challenge',
  '각인된 악몽 "죽음을 딛고 선 자"',
  '2026-11-04T21:00:00.000Z',
  [week(LAST_CLOSED_WEEK, 3), week(LATEST_WEEK, 6, 2000)]
)

const stats: ClearStats = {
  contents: [nabelHard, diregieHard, michaelaNormal, michaelaHard, nightmare],
  legions: []
}

const fame = { p5: 110000, p25: 118000, median: 122000, p75: 126000, p95: 132000, max: 140000 }
const noScores = { equipment: null, buff: null }
const equipment = { p5: 280000, p25: 310000, median: 330000, p75: 350000, p95: 380000, max: 420000 }
const buff = { p5: 120000, p25: 140000, median: 150000, p75: 160000, p95: 180000, max: 200000 }

function job(index: number, population: number, cleared: number): ClearOverviewJob {
  return {
    jobId: `job-${index}`,
    jobGrowId: `grow-${index}`,
    jobName: `직업${index}`,
    jobGrowName: `眞 전직${index}`,
    population,
    cleared,
    fame,
    scores: noScores
  }
}

// 클리어율이 20%부터 1%p씩 내려가는 전직 20개.
const jobs = Array.from({ length: 20 }, (_, index) => job(index, 100, 20 - index))

function overviewOf(weekStart: string): ClearOverview {
  return {
    weekStart,
    contents: [
      {
        id: 'michaela-normal',
        cleared: 100,
        fame: { ...fame, median: 121000 },
        scores: noScores,
        jobs: []
      },
      {
        id: 'michaela-hard',
        cleared: 60,
        fame: { ...fame, median: 125000 },
        scores: noScores,
        jobs
      },
      {
        id: 'engraved-nightmare-1',
        cleared: 6,
        fame: null,
        scores: noScores,
        jobs: []
      }
    ],
    weekdays: [4, 5, 6, 7, 1, 2, 3].map((weekday) => ({
      weekday,
      cleared: weekday === 6 ? 50 : 10
    })),
    hours: Array.from({ length: 24 }, (_, hour) => ({ hour, cleared: hour }))
  }
}

function contentStatsOf(contentId: string): ClearContentStats {
  const { weeks, ...header } = stats.contents.find(({ id }) => id === contentId)!
  const latest = weeks.at(-1) ?? null

  return {
    ...header,
    week: latest,
    jobs: [],
    adventures: [
      { characters: 1, adventures: 40 },
      { characters: 12, adventures: 3 },
      { characters: 13, adventures: 2 },
      { characters: 20, adventures: 5 }
    ],
    weeklyClears: [],
    fameBands: [],
    weekOverWeek: null,
    weekMoves: null,
    streaks: null,
    scoreBands: { equipment: [], buff: [] },
    weekdays: [],
    hours: []
  }
}

type Reply = () => Response | Promise<Response>

type Replies = Readonly<{
  stats?: Reply
  overview?: (weekStart: string) => Response | Promise<Response>
  contentStats?: (contentId: string) => Response | Promise<Response>
}>

type Handlers = Readonly<{
  onContentOpen?: (contentKey: string, weekStart: string) => void
}>

function serverError(message: string): Response {
  return HttpResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message } }, { status: 500 })
}

function pending(): Promise<never> {
  return new Promise<never>(() => {})
}

function record(request: Request): URL {
  requested.push(request.url.slice(API_BASE_URL.length))

  return new URL(request.url)
}

// 컨텐츠 집계 경로가 개요 경로도 받으므로 개요 handler를 앞에 둔다.
function respond({
  stats: statsReply = () => HttpResponse.json(stats),
  overview = (selected) => HttpResponse.json(overviewOf(selected)),
  contentStats = (contentId) => HttpResponse.json(contentStatsOf(contentId))
}: Replies): void {
  server.use(
    http.get(CLEAR_STATS_URL, ({ request }) => {
      record(request)

      return statsReply()
    }),
    http.get(CLEAR_OVERVIEW_URL, ({ request }) => {
      const url = record(request)

      return overview(url.searchParams.get('week') ?? '')
    }),
    http.get(CLEAR_CONTENT_STATS_URL, ({ params, request }) => {
      record(request)

      return contentStats(String(params.contentId))
    })
  )
}

function render(replies: Replies = {}, { onContentOpen = () => {} }: Handlers = {}): Promise<void> {
  respond(replies)

  return act(async () =>
    root.render(
      <TestQueryClient>
        <ClearOverviewScreen onContentOpen={onContentOpen} />
      </TestQueryClient>
    )
  )
}

function loading(): boolean {
  if (container.querySelector('[aria-busy="true"], [aria-hidden="true"] .skeleton-text') != null) {
    return true
  }

  const adventures = panel('모험단 기준 클리어 횟수')

  return adventures != null && adventures.lastElementChild?.childElementCount === 0
}

async function open(replies: Replies = {}, handlers: Handlers = {}): Promise<void> {
  await render(replies, handlers)
  await vi.waitFor(() => expect(loading()).toBe(false))
}

function requestsTo(path: string): string[] {
  return requested.filter((request) => request.startsWith(path))
}

function panel(name: string): HTMLElement | null {
  return container.querySelector<HTMLElement>(`section[aria-label="${name}"]`)
}

function panelNames(): string[] {
  return [...container.querySelectorAll('section[aria-label]')].map(
    (section) => section.getAttribute('aria-label') ?? ''
  )
}

function cards(): string[] {
  return [...container.querySelectorAll('nav[aria-label="컨텐츠"] > div > button')].map(
    (card) => card.textContent ?? ''
  )
}

function buttonNamed(name: string): HTMLButtonElement {
  return [...container.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) => button.textContent === name
  )!
}

function legendMarks(): Record<string, string | null | undefined> {
  const items = [...(panel('주간 클리어율')?.querySelectorAll('ul li') ?? [])].filter(
    (item) => item.querySelector('i') != null
  )

  return Object.fromEntries(
    items.map((item) => [item.textContent ?? '', item.querySelector('i')?.getAttribute('style')])
  )
}

function legendMarkClass(name: string): string | undefined {
  const items = [...(panel('주간 클리어율')?.querySelectorAll('ul li') ?? [])]

  return items.find((item) => item.textContent === name)?.querySelector('i')?.className
}

async function columnTooltips(name: string): Promise<(string | null)[]> {
  const box = panel(name)!
  const tooltip = box.querySelector('ul + [aria-hidden="true"]')!
  const texts: (string | null)[] = []

  for (const column of box.querySelectorAll('li:not([aria-hidden])')) {
    await act(async () => {
      column.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    })
    texts.push(tooltip.textContent)
  }

  return texts
}

function click(element: Element): Promise<void> {
  return act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

it('받는 중에는 제목만 두고 패널은 두지 않는다', async () => {
  await render({ stats: pending })

  expect(container.querySelector('h1')?.textContent).toBe('클리어 집계')
  expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  expect(panelNames()).toEqual([])
})

it('조회가 실패하면 제목 줄과 오류 한 줄을 둔다', async () => {
  await open({ stats: () => serverError('통계를 불러오지 못했습니다.') })

  expect(container.querySelector('h1')?.textContent).toBe('클리어 집계')
  expect(container.querySelector('[role="alert"]')?.textContent).toBe('통계를 불러오지 못했습니다.')
})

it('수집한 주가 하나도 없으면 제목 줄 아래 한 줄만 두고 개요를 부르지 않는다', async () => {
  await open({
    stats: () =>
      HttpResponse.json({
        contents: stats.contents.map((item) => ({ ...item, weeks: [] })),
        legions: []
      })
  })

  expect(container.textContent).toBe('클리어 집계수집 기록이 없습니다.')
  expect(requested).toEqual(['/stats/clears'])
})

it('제목은 화면에서 숨기고 가장 최근 주의 기간을 수집 날짜로 기준 명성 왼쪽에 두며 가장 넓은 분모의 기준 명성과 캐릭터 수를 보인다', async () => {
  await open()

  expect(container.querySelector('[aria-label="주 선택"]')).toBeNull()
  expect(container.querySelector('h1')?.className).toBe('sr-only')
  expect(container.querySelector('header')?.textContent).toBe(
    '클리어 집계수집 날짜11-12 ~ 11-18기준 명성104,292 이상캐릭터 수2,000'
  )
  expect(requestsTo('/stats/clears/overview')).toEqual([
    `/stats/clears/overview?week=${LATEST_WEEK}`
  ])
  expect(container.textContent).not.toContain('모집단')
})

it('컨텐츠 카드는 출시가 최근인 것부터 일반과 하드를 한 장에 두고 클리어율, 지난주 대비 증감, 클리어 수를 적으며 각인된 악몽은 이름 아래 몬스터 이름을 적는다', async () => {
  await open()

  expect(cards()).toEqual([
    '챌린지각인된 악몽더러운 피를 흘리는 자0.3%0.0%p6',
    '레이드무너진 성자 미카엘라하드6.0%▲ 0.3%p60일반10.0%▼ 0.6%p100',
    '레이드만들어진 신 나벨하드4.0%0.0%p40'
  ])
  const changes = [...container.querySelectorAll('nav[aria-label="컨텐츠"] span')]
    .filter((span) => span.textContent?.endsWith('%p'))
    .map((span) => span.textContent)
  expect(changes).toEqual(['0.0%p', '▲ 0.3%p', '▼ 0.6%p', '0.0%p'])
})

it('컨텐츠 카드를 누르면 그 컨텐츠 묶음과 최근 주로 상세를 연다', async () => {
  const onContentOpen = vi.fn()
  await open({}, { onContentOpen })

  const card = [...container.querySelectorAll('nav[aria-label="컨텐츠"] > div > button')][1]!
  await click(card)

  expect(onContentOpen).toHaveBeenCalledWith('michaela', LATEST_WEEK)
})

it('주간 클리어율은 레이드의 하드와 일반 선을 함께 그리고 기간을 줄여 선이 빠져도 남은 컨텐츠의 색을 바꾸지 않는다', async () => {
  await open()

  expect(panel('주간 클리어율')?.querySelector('[aria-label="단계"]')).toBeNull()
  const halfYear = legendMarks()
  expect(Object.keys(halfYear)).toEqual([
    '미카엘라 하드',
    '미카엘라 일반',
    '디레지에 하드',
    '나벨 하드'
  ])
  expect(halfYear['미카엘라 일반']).toBe(halfYear['미카엘라 하드'])
  expect(legendMarkClass('미카엘라 일반')).not.toBe(legendMarkClass('미카엘라 하드'))

  await click(buttonNamed('3개월'))

  const quarter = legendMarks()
  expect(Object.keys(quarter)).toEqual(['미카엘라 하드', '미카엘라 일반', '나벨 하드'])
  expect(quarter['미카엘라 하드']).toBe(halfYear['미카엘라 하드'])
  expect(quarter['나벨 하드']).toBe(halfYear['나벨 하드'])
  expect(quarter['나벨 하드']).not.toBe(quarter['미카엘라 하드'])
})

it('명성 box plot은 분포가 있는 컨텐츠만 중앙값이 높은 순으로 둔다', async () => {
  await open()

  const names = [
    ...(panel('클리어 캐릭터의 명성')?.querySelectorAll('li > span:first-child') ?? [])
  ].map((name) => name.firstChild?.textContent)
  expect(names).toEqual(['미카엘라', '미카엘라'])
  const subs = [...(panel('클리어 캐릭터의 명성')?.querySelectorAll('li small') ?? [])].map((sub) =>
    sub.textContent?.trim()
  )
  expect(subs).toEqual(['하드', '일반'])
})

it('전직별 클리어는 첫 레이드를 기준으로 클리어율이 높은 전직 8개와 낮은 전직 8개를 클리어율과 함께 둔다', async () => {
  await open()

  const lists = [...(panel('전직별 클리어')?.querySelectorAll('[role="group"]') ?? [])].map(
    (list) => [
      list.getAttribute('aria-label'),
      [...list.querySelectorAll('li')].map((row) => row.lastElementChild?.textContent)
    ]
  )
  expect(lists).toEqual([
    [
      '클리어율 높은 전직',
      ['20.0%', '19.0%', '18.0%', '17.0%', '16.0%', '15.0%', '14.0%', '13.0%']
    ],
    ['클리어율 낮은 전직', ['1.0%', '2.0%', '3.0%', '4.0%', '5.0%', '6.0%', '7.0%', '8.0%']]
  ])
})

it('전직별 클리어 순위는 眞 각성 전 전직을 클리어율이 가장 높아도 두지 않는다', async () => {
  await open({
    overview: (selected) => {
      const overview = overviewOf(selected)
      const unawakened = { ...job(20, 2, 2), jobName: '아처', jobGrowName: '하이드라' }
      const contents = overview.contents.map((item) => ({
        ...item,
        jobs: [...item.jobs, unawakened]
      }))

      return HttpResponse.json({ ...overview, contents })
    }
  })

  const high = panel('전직별 클리어')?.querySelector('[aria-label="클리어율 높은 전직"]')
  const rates = [...(high?.querySelectorAll('li') ?? [])].map(
    (row) => row.lastElementChild?.textContent
  )

  expect(rates[0]).toBe('20.0%')
  expect(panel('전직별 클리어')?.textContent).not.toContain('하이드라')
})

it('함께 깬 컨텐츠 패널은 두지 않는다', async () => {
  await open()

  expect(panel('함께 깬 컨텐츠')).toBeNull()
})

it('모험단 기준 클리어 횟수는 기준 컨텐츠의 상세를 그 주로 받아 1명부터 12명과 13명 이상으로 센다', async () => {
  await open()

  expect(requestsTo('/stats/clears/michaela-hard')).toEqual([
    `/stats/clears/michaela-hard?week=${LATEST_WEEK}`
  ])
  const columns = await columnTooltips('모험단 기준 클리어 횟수')
  expect(columns.at(0)).toMatch(/^1명40 /)
  expect(columns.at(11)).toMatch(/^12명3 /)
  expect(columns.at(12)).toMatch(/^13명 이상7 /)
  expect(columns).toHaveLength(13)
})

it('모험단 기준 클리어 횟수는 1~5명과 6명 이상을 나눠 각 묶음의 가장 큰 칸에 막대 높이를 맞춘다', async () => {
  await open()

  const box = panel('모험단 기준 클리어 횟수')!
  const heights = [...box.querySelectorAll('li:not([aria-hidden])')].map((column) =>
    column.querySelector('[data-chart-mark]')?.getAttribute('style')
  )

  expect(heights[0]).toContain('100%')
  expect(heights[12]).toContain('100%')
})

it('값이 없는 통계는 패널과 점수 전환을 두지 않는다', async () => {
  await open({
    overview: (selected) =>
      HttpResponse.json({
        ...overviewOf(selected),
        contents: overviewOf(selected).contents.map((item) => ({
          ...item,
          fame: null,
          jobs: []
        })),
        weekdays: [4, 5, 6, 7, 1, 2, 3].map((weekday) => ({ weekday, cleared: 0 })),
        hours: []
      }),
    contentStats: (contentId) => HttpResponse.json({ ...contentStatsOf(contentId), adventures: [] })
  })

  expect(panelNames()).toEqual(['주간 클리어율'])
})

it('개요 조회가 실패하면 카드와 주간 클리어율은 두고 오류 한 줄을 둔다', async () => {
  await open({ overview: () => serverError('개요를 불러오지 못했습니다.') })

  expect(cards()).toHaveLength(3)
  expect(panelNames()).toEqual(['주간 클리어율'])
  expect(container.querySelector('[role="alert"]')?.textContent).toBe('개요를 불러오지 못했습니다.')
})

function axisTicks(name: string): string[] {
  return [...(panel(name)?.querySelectorAll('svg text') ?? [])].map(
    (text) => text.textContent ?? ''
  )
}

it('레기온 기록이 있으면 출시 순서에 맞춰 레기온 카드를 두고 주간 클리어율에 레기온 선을 더한다', async () => {
  const apocalypse = content(
    'legion-apocalypse',
    'legion',
    '아포칼립스',
    '2026-04-22T21:00:00.000Z',
    recentWeeks([420, 400], 1000)
  )
  await open({
    stats: () => HttpResponse.json({ ...stats, legions: [{ ...apocalypse, entryFame: null }] })
  })

  expect(cards().map((card) => card.slice(0, 8))).toEqual([
    '챌린지각인된 악',
    '레이드무너진 성',
    '레기온아포칼립스',
    '레이드만들어진 '
  ])
  expect(Object.keys(legendMarks())).toEqual([
    '미카엘라 하드',
    '미카엘라 일반',
    '디레지에 하드',
    '나벨 하드',
    '아포칼립스'
  ])
})

it('점수가 있는 주에는 장비 점수 카드를 두고, 장비와 버프를 바꾸면 축이 그 점수 기준으로 바뀐다', async () => {
  await open({
    overview: (selected) => {
      const overview = overviewOf(selected)
      const contents = overview.contents.map((item) => ({ ...item, scores: { equipment, buff } }))

      return HttpResponse.json({ ...overview, contents })
    }
  })

  expect(panelNames()).toContain('클리어 캐릭터의 장비 점수')
  const equipmentTicks = axisTicks('클리어 캐릭터의 장비 점수')
  expect(equipmentTicks).toContain('30만')

  await click(buttonNamed('버프'))

  const buffTicks = axisTicks('클리어 캐릭터의 장비 점수')
  expect(buffTicks).toContain('14만')
  expect(buffTicks).not.toEqual(equipmentTicks)
})

it('한 가지 점수만 있으면 장비 점수 카드에 전환을 두지 않는다', async () => {
  await open({
    overview: (selected) => {
      const overview = overviewOf(selected)
      const contents = overview.contents.map((item) => ({
        ...item,
        scores: { equipment, buff: null }
      }))

      return HttpResponse.json({ ...overview, contents })
    }
  })

  expect(panel('클리어 캐릭터의 장비 점수')?.querySelector('[aria-label="점수 종류"]')).toBeNull()
})

it('전직 점수가 있으면 전직별 클리어에 명성, 장비 점수 전환을 두고, 장비 점수로 바꿔도 같은 전직 목록에 점수 분포를 그린다', async () => {
  await open({
    overview: (selected) => {
      const overview = overviewOf(selected)
      const contents = overview.contents.map((item) => {
        const jobs = item.jobs.map((candidate, index) => {
          if (index === 0) {
            return {
              ...candidate,
              jobName: '거너(남)',
              jobGrowName: '眞 레인저',
              scores: noScores
            }
          }

          return { ...candidate, scores: { equipment, buff: null } }
        })

        return { ...item, jobs }
      })

      return HttpResponse.json({ ...overview, contents })
    }
  })

  const jobPanel = panel('전직별 클리어')
  const jobNames = () =>
    [...(jobPanel?.querySelectorAll('li > span:first-child') ?? [])].map(
      (name) => name.firstChild?.textContent
    )
  expect(jobPanel?.querySelector('[aria-label="분포"]')?.textContent).toBe('명성장비 점수')
  expect(axisTicks('전직별 클리어')).toContain('120,000')
  const fameNames = jobNames()

  await click(buttonNamed('장비 점수'))

  expect(jobPanel?.textContent).toContain('클리어 캐릭터의 장비 점수')
  expect(axisTicks('전직별 클리어')).toContain('30만')
  expect(jobNames()).toEqual(fameNames)
  expect(jobNames()[0]).toBe('레인저(남)')
})
