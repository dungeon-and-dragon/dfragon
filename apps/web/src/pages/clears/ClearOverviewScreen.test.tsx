// @vitest-environment jsdom
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
} from '#core/ranking/clear-stats'
import { type ClientHost, ClientHostContext } from '../../host/client-host'
import { createTestClientHost } from '../../testing/test-support/client-host'
import { TestQueryClient } from '../../testing/test-support/test-query-client'
import { ClearOverviewScreen } from './ClearOverviewScreen'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
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
  vi.unstubAllGlobals()
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
    collectedAt: '2026-11-13T22:39:00.000Z',
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
  contents: [nabelHard, diregieHard, michaelaNormal, michaelaHard, nightmare]
}

const fame = { p5: 110000, p25: 118000, median: 122000, p75: 126000, p95: 132000, max: 140000 }

function job(index: number, population: number, cleared: number): ClearOverviewJob {
  return {
    jobId: `job-${index}`,
    jobGrowId: `grow-${index}`,
    jobName: `직업${index}`,
    jobGrowName: `眞 전직${index}`,
    population,
    cleared,
    fame
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
        jobs: [],
        coClears: []
      },
      {
        id: 'michaela-hard',
        cleared: 60,
        fame: { ...fame, median: 125000 },
        jobs,
        coClears: [
          { id: 'michaela-normal', cleared: 6 },
          { id: 'nightmare-unknown', cleared: 1 },
          { id: 'engraved-nightmare-1', cleared: 30 }
        ]
      },
      { id: 'engraved-nightmare-1', cleared: 6, fame: null, jobs: [], coClears: [] }
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
    ]
  }
}

type Loaders = Partial<
  Pick<ClientHost, 'getClearStats' | 'getClearOverview' | 'getClearContentStats'>
>

type Handlers = Readonly<{
  onWeekSelect?: (weekStart: string) => void
  onContentOpen?: (contentId: string, weekStart: string) => void
}>

function render(
  weekStart: string | undefined,
  {
    getClearStats = async () => stats,
    getClearOverview = vi.fn(async (selected: string) => overviewOf(selected)),
    getClearContentStats = vi.fn(async (contentId: string) => contentStatsOf(contentId))
  }: Loaders = {},
  { onWeekSelect = () => {}, onContentOpen = () => {} }: Handlers = {}
): Promise<void> {
  return act(async () =>
    root.render(
      <ClientHostContext
        value={createTestClientHost({ getClearStats, getClearOverview, getClearContentStats })}
      >
        <TestQueryClient>
          <ClearOverviewScreen
            week={weekStart}
            onWeekSelect={onWeekSelect}
            onContentOpen={onContentOpen}
          />
        </TestQueryClient>
      </ClientHostContext>
    )
  )
}

function panel(name: string): HTMLElement | null {
  return container.querySelector<HTMLElement>(`section[aria-label="${name}"]`)
}

function panelNames(): string[] {
  return [...container.querySelectorAll('section[aria-label]')].map(
    (section) => section.getAttribute('aria-label') ?? ''
  )
}

function wheelRows(): string[] {
  return [...container.querySelectorAll('[aria-label="주 선택"] > *')].map(
    (row) => row.textContent ?? ''
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

function click(element: Element): Promise<void> {
  return act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

it('받는 중에는 제목 줄만 둔다', async () => {
  await render(undefined, { getClearStats: () => new Promise<never>(() => {}) })

  expect(container.querySelector('h1')?.textContent).toBe('클리어 집계')
  expect(container.querySelector('[role="status"]')?.textContent).toBe(
    '클리어 집계를 받는 중입니다.'
  )
  expect(container.querySelector('[aria-label="주 선택"]')).toBeNull()
  expect(panelNames()).toEqual([])
})

it('조회가 실패하면 제목 줄과 오류 한 줄을 둔다', async () => {
  await render(undefined, {
    getClearStats: async () => {
      throw new Error('통계를 불러오지 못했습니다.')
    }
  })

  expect(container.querySelector('h1')?.textContent).toBe('클리어 집계')
  expect(container.querySelector('[role="alert"]')?.textContent).toBe('통계를 불러오지 못했습니다.')
})

it('수집한 주가 하나도 없으면 제목 줄 아래 한 줄만 두고 개요를 부르지 않는다', async () => {
  const getClearOverview = vi.fn(async (selected: string) => overviewOf(selected))
  await render(undefined, {
    getClearStats: async () => ({
      contents: stats.contents.map((item) => ({ ...item, weeks: [] }))
    }),
    getClearOverview
  })

  expect(container.textContent).toBe('클리어 집계수집 기록이 없습니다.')
  expect(getClearOverview).not.toHaveBeenCalled()
})

it('주를 고르지 않으면 가장 최근 주를 가운데에 두고 가장 넓은 분모의 기준 명성, 캐릭터 수와 수집 시각을 보인다', async () => {
  const getClearOverview = vi.fn(async (selected: string) => overviewOf(selected))
  await render(undefined, { getClearOverview })

  expect(wheelRows()).toEqual(['11-05 ~ 11-11', '11-12 ~ 11-18집계 중', ''])
  expect(container.querySelector('header')?.textContent).toBe(
    '클리어 집계11-05 ~ 11-1111-12 ~ 11-18집계 중기준 명성104,292 이상캐릭터 수2,000수집 시각11-14 07:39'
  )
  expect(getClearOverview).toHaveBeenCalledWith(LATEST_WEEK)
  expect(container.textContent).not.toContain('모집단')
})

it('컨텐츠 카드는 출시가 최근인 것부터 일반과 하드를 한 장에 두고 클리어율, 지난주 대비 증감, 클리어 수를 적는다', async () => {
  await render(undefined)

  expect(cards()).toEqual([
    '챌린지각인된 악몽0.3%0.0%p6',
    '레이드무너진 성자 미카엘라하드6.0%▲ 0.3%p60일반10.0%▼ 0.6%p100',
    '레이드만들어진 신 나벨하드4.0%0.0%p40'
  ])
  const changes = [...container.querySelectorAll('nav[aria-label="컨텐츠"] span')]
    .filter((span) => span.textContent?.endsWith('%p'))
    .map((span) => span.textContent)
  expect(changes).toEqual(['0.0%p', '▲ 0.3%p', '▼ 0.6%p', '0.0%p'])
})

it('휠의 이전 주와 다음 주를 누르면 그 주를 고르고, 고른 주가 바뀌면 카드와 개요를 그 주 값으로 다시 그린다', async () => {
  const onWeekSelect = vi.fn()
  const getClearOverview = vi.fn(async (selected: string) => overviewOf(selected))
  await render(undefined, { getClearOverview }, { onWeekSelect })

  await click(buttonNamed('11-05 ~ 11-11'))
  expect(onWeekSelect).toHaveBeenCalledWith(LAST_CLOSED_WEEK)

  await render(LAST_CLOSED_WEEK, { getClearOverview }, { onWeekSelect })

  expect(wheelRows()).toEqual(['10-29 ~ 11-04', '11-05 ~ 11-11', '11-12 ~ 11-18집계 중'])
  expect(getClearOverview).toHaveBeenLastCalledWith(LAST_CLOSED_WEEK)
  await click(buttonNamed('11-12 ~ 11-18집계 중'))
  expect(onWeekSelect).toHaveBeenLastCalledWith(LATEST_WEEK)
  expect(cards()).toEqual([
    '챌린지각인된 악몽0.3%3',
    '레이드무너진 성자 미카엘라하드5.7%▼ 0.4%p57일반10.6%0.0%p106',
    '레이드만들어진 신 나벨하드4.0%0.0%p40'
  ])
})

it('컨텐츠 카드를 누르면 그 컨텐츠의 첫 단계와 고른 주로 상세를 연다', async () => {
  const onContentOpen = vi.fn()
  await render(LAST_CLOSED_WEEK, {}, { onContentOpen })

  const card = [...container.querySelectorAll('nav[aria-label="컨텐츠"] > div > button')][1]!
  await click(card)

  expect(onContentOpen).toHaveBeenCalledWith('michaela-hard', LAST_CLOSED_WEEK)
})

it('주간 클리어율은 레이드만 단계별 선으로 그리고 기간을 줄여 선이 빠져도 남은 컨텐츠의 색을 바꾸지 않는다', async () => {
  await render(undefined)

  const halfYear = legendMarks()
  expect(Object.keys(halfYear)).toEqual(['미카엘라 하드', '디레지에 하드', '나벨 하드'])

  await click(buttonNamed('3개월'))

  const quarter = legendMarks()
  expect(Object.keys(quarter)).toEqual(['미카엘라 하드', '나벨 하드'])
  expect(quarter['미카엘라 하드']).toBe(halfYear['미카엘라 하드'])
  expect(quarter['나벨 하드']).toBe(halfYear['나벨 하드'])
  expect(quarter['나벨 하드']).not.toBe(quarter['미카엘라 하드'])
})

it('명성 box plot은 분포가 있는 컨텐츠만 중앙값이 높은 순으로 둔다', async () => {
  await render(undefined)

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
  await render(undefined)

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

it('함께 깬 컨텐츠는 기준 컨텐츠의 클리어 수와 다른 컨텐츠를 함께 깬 비율을 높은 순으로 둔다', async () => {
  await render(undefined)

  const coClear = panel('함께 깬 컨텐츠')
  expect(coClear?.textContent).toContain('미카엘라 하드 클리어 캐릭터60')
  const rows = [...(coClear?.querySelectorAll('li') ?? [])].map((row) =>
    [...row.children].slice(0, 3).map((cell) => cell.textContent)
  )
  expect(rows).toEqual([
    ['각인된 악몽', '', '50.0%'],
    ['미카엘라 일반', '', '10.0%']
  ])
})

it('모험단당 클리어 캐릭터는 기준 컨텐츠의 상세를 그 주로 받아 1명부터 12명과 13명 이상으로 센다', async () => {
  const getClearContentStats = vi.fn(async (contentId: string) => contentStatsOf(contentId))
  await render(undefined, { getClearContentStats })

  expect(getClearContentStats).toHaveBeenCalledWith('michaela-hard', LATEST_WEEK)
  const columns = [...(panel('모험단당 클리어 캐릭터')?.querySelectorAll('li') ?? [])].map(
    (column) => column.querySelector('span')?.textContent
  )
  expect(columns.at(0)).toMatch(/^1명 40 /)
  expect(columns.at(11)).toMatch(/^12명 3 /)
  expect(columns.at(12)).toMatch(/^13명 이상 7 /)
  expect(columns).toHaveLength(13)
})

it('값이 없는 통계는 패널을 두지 않는다', async () => {
  await render(undefined, {
    getClearOverview: async (selected) => ({
      ...overviewOf(selected),
      contents: overviewOf(selected).contents.map((item) => ({
        ...item,
        fame: null,
        jobs: [],
        coClears: []
      })),
      weekdays: [4, 5, 6, 7, 1, 2, 3].map((weekday) => ({ weekday, cleared: 0 })),
      hours: []
    }),
    getClearContentStats: async (contentId) => ({ ...contentStatsOf(contentId), adventures: [] })
  })

  expect(panelNames()).toEqual(['주간 클리어율'])
})

it('개요 조회가 실패하면 카드와 주간 클리어율은 두고 오류 한 줄을 둔다', async () => {
  await render(undefined, {
    getClearOverview: async () => {
      throw new Error('개요를 불러오지 못했습니다.')
    }
  })

  expect(cards()).toHaveLength(3)
  expect(panelNames()).toEqual(['주간 클리어율'])
  expect(container.querySelector('[role="alert"]')?.textContent).toBe('개요를 불러오지 못했습니다.')
})
