// @vitest-environment jsdom
import * as stylex from '@stylexjs/stylex'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { AdventureActivity } from '@dfragon/client-core/shared/adventure-guild/adventure-activity'
import { ClientHostContext, type ClientHost } from '../../hooks/useClientHost'
import { createTestClientHost } from '../../testing/test-support/client-host'
import { TestQueryClient } from '../../testing/test-support/test-query-client'
import { TestRouter } from '../../testing/test-support/test-router'
import { styles } from './SeasonTimeline.style'
import { WeeklyScreen } from './WeeklyScreen'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

const emptySummary: AdventureActivity['summary'] = {
  raids: [],
  legions: [],
  items: { legendary: 0, epic: 0, primeval: 0, mythic: 0 },
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
    items: { legendary: 7, epic: 4, primeval: 2, mythic: 1 },
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

function render(
  getAdventureActivity: ClientHost['getAdventureActivity'],
  season: number | undefined,
  onSeasonChange: (season: number) => void = vi.fn(),
  backfillAdventureSeason?: ClientHost['backfillAdventureSeason']
): Promise<void> {
  return act(async () =>
    root.render(
      <ClientHostContext
        value={createTestClientHost({ getAdventureActivity, backfillAdventureSeason })}
      >
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
      </ClientHostContext>
    )
  )
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

it('시즌을 고르지 않으면 지금 시즌을 받아 모험단 이름 위에 다른 글자 없이 시즌 이름, 시작일과 요약 숫자 4개를 보인다', async () => {
  vi.useFakeTimers({ toFake: ['Date'], now: Date.parse('2026-11-08T03:00:00.000Z') })
  try {
    const getAdventureActivity = vi.fn<ClientHost['getAdventureActivity']>(
      async () => currentSeason
    )
    await render(getAdventureActivity, undefined)

    expect(getAdventureActivity).toHaveBeenCalledWith('합성 모험단', undefined)
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
  const getAdventureActivity = vi
    .fn<ClientHost['getAdventureActivity']>()
    .mockResolvedValueOnce(currentSeason)
    .mockReturnValueOnce(loaded.promise)
  await render(getAdventureActivity, undefined, onSeasonChange)

  await act(async () => seasonButton('합성 시즌 11').click())
  expect(onSeasonChange).not.toHaveBeenCalled()
  await act(async () => seasonButton('합성 시즌 10').click())
  expect(onSeasonChange).toHaveBeenCalledWith(10)

  await render(getAdventureActivity, 10, onSeasonChange)
  expect(getAdventureActivity).toHaveBeenLastCalledWith('합성 모험단', 10)
  expect(currentSeasonName()).toBe('합성 시즌 10')
  expect(container.textContent).toContain('시즌 10합성 시즌 10441일2025.01.09 ~ 2026.03.25')
  expect(heroBusy()).toBe('true')
  expect(container.querySelectorAll('[tabindex="0"]')).toHaveLength(0)

  await act(async () => loaded.resolve(previousSeason))
  expect(heroBusy()).toBe('false')
  expect(statValues()).toEqual(['9', '0', '0', '0'])
})

it('타임라인 수집 전 시즌은 누를 수 없고 눌러도 시즌을 바꾸지 않는다', async () => {
  const onSeasonChange = vi.fn()
  await render(async () => currentSeason, undefined, onSeasonChange)

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
  const backfillAdventureSeason = vi.fn<ClientHost['backfillAdventureSeason']>(async () =>
    backfillSeason(running)
  )
  await render(
    async () => withBackfill(currentSeason, { done: 0, total: 30, running: false }),
    undefined,
    onSeasonChange,
    backfillAdventureSeason
  )
  expect(seasonButton('합성 시즌 9').disabled).toBe(false)
  expect(filledPercent('합성 시즌 9')).toBe(0)

  await act(async () => seasonButton('합성 시즌 9').click())

  expect(backfillAdventureSeason).toHaveBeenCalledWith('합성 모험단', 9)
  expect(onSeasonChange).not.toHaveBeenCalled()
  expect(currentSeasonName()).toBe('합성 시즌 11')
  expect(filledPercent('합성 시즌 9')).toBe(40)
  expect(progressText('합성 시즌 9')).toBe('40%')
  expect(seasonButton('합성 시즌 9').getAttribute('aria-busy')).toBe('true')

  await act(async () => seasonButton('합성 시즌 9').click())
  expect(backfillAdventureSeason).toHaveBeenCalledOnce()
})

it('받는 동안 시즌 활동을 다시 조회해 막대를 늘리고, 다 받으면 조회를 멈추고 그 시즌을 고를 수 있다', async () => {
  vi.useFakeTimers()
  try {
    const onSeasonChange = vi.fn()
    const getAdventureActivity = vi
      .fn<ClientHost['getAdventureActivity']>()
      .mockResolvedValueOnce(withBackfill(currentSeason, { done: 6, total: 30, running: true }))
      .mockResolvedValueOnce(withBackfill(currentSeason, { done: 24, total: 30, running: true }))
      .mockResolvedValue(withBackfill(currentSeason, { done: 30, total: 30, running: false }, true))
    await render(getAdventureActivity, undefined, onSeasonChange)
    expect(filledPercent('합성 시즌 9')).toBe(20)

    await act(async () => vi.advanceTimersByTimeAsync(3000))
    expect(filledPercent('합성 시즌 9')).toBe(80)

    await act(async () => vi.advanceTimersByTimeAsync(3000))
    expect(progressText('합성 시즌 9')).toBeUndefined()
    expect(filledPercent('합성 시즌 9')).toBeUndefined()
    expect(seasonButton('합성 시즌 9').getAttribute('aria-busy')).toBeNull()

    const calls = getAdventureActivity.mock.calls.length
    await act(async () => vi.advanceTimersByTimeAsync(30_000))
    expect(getAdventureActivity).toHaveBeenCalledTimes(calls)

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
    const getAdventureActivity = vi
      .fn<ClientHost['getAdventureActivity']>()
      .mockResolvedValueOnce(withBackfill(currentSeason, { done: 12, total: 30, running: false }))
      .mockResolvedValue(withBackfill(currentSeason, { done: 18, total: 30, running: true }))
    const backfillAdventureSeason = vi.fn<ClientHost['backfillAdventureSeason']>(async () =>
      backfillSeason(withBackfill(currentSeason, { done: 12, total: 30, running: true }))
    )
    await render(getAdventureActivity, undefined, onSeasonChange, backfillAdventureSeason)
    expect(filledPercent('합성 시즌 9')).toBe(40)
    expect(seasonButton('합성 시즌 9').getAttribute('aria-busy')).toBeNull()

    await act(async () => vi.advanceTimersByTimeAsync(30_000))
    expect(getAdventureActivity).toHaveBeenCalledOnce()

    await act(async () => seasonButton('합성 시즌 9').click())
    expect(backfillAdventureSeason).toHaveBeenCalledWith('합성 모험단', 9)
    expect(onSeasonChange).not.toHaveBeenCalled()
    expect(seasonButton('합성 시즌 9').getAttribute('aria-busy')).toBe('true')

    await act(async () => vi.advanceTimersByTimeAsync(3000))
    expect(getAdventureActivity).toHaveBeenCalledTimes(2)
    expect(filledPercent('합성 시즌 9')).toBe(60)
  } finally {
    vi.useRealTimers()
  }
})

it('받는 중에 받아 둔 다른 시즌으로 바꿔도 그 시즌 응답으로 진행 조회를 이어 간다', async () => {
  vi.useFakeTimers()
  try {
    let backfill = { done: 12, total: 30, running: false }
    const getAdventureActivity = vi.fn<ClientHost['getAdventureActivity']>(async (_, season) =>
      withBackfill(season === 10 ? previousSeason : currentSeason, backfill)
    )
    const backfillAdventureSeason = vi.fn<ClientHost['backfillAdventureSeason']>(async () => {
      backfill = { done: 12, total: 30, running: true }

      return backfillSeason(withBackfill(currentSeason, backfill))
    })
    await render(getAdventureActivity, 10, vi.fn(), backfillAdventureSeason)
    await render(getAdventureActivity, 11, vi.fn(), backfillAdventureSeason)
    await act(async () => seasonButton('합성 시즌 9').click())

    backfill = { done: 18, total: 30, running: true }
    await render(getAdventureActivity, 10, vi.fn(), backfillAdventureSeason)
    expect(getAdventureActivity).toHaveBeenCalledTimes(2)

    await act(async () => vi.advanceTimersByTimeAsync(3000))
    expect(getAdventureActivity).toHaveBeenLastCalledWith('합성 모험단', 10)
    expect(filledPercent('합성 시즌 9')).toBe(60)
  } finally {
    vi.useRealTimers()
  }
})

it('요약 숫자에 키보드 focus를 주면 내역이 열리고, 강화는 높은 단계부터 증폭, 강화 순 성공/시도 뒤에 나머지 횟수를 보인다', async () => {
  await render(async () => currentSeason, undefined)

  await act(async () => stat('레이드').focus())
  expect(tooltipRows()).toEqual(['가 레이드1,200회', '나 레이드3회'])

  await act(async () => stat('아이템').focus())
  expect(tooltipRows()).toEqual(['레전더리7개', '에픽4개', '태초2개', '신화1개'])

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

it('아이템 내역은 개수가 0인 등급 줄을 뺀다', async () => {
  const items = { legendary: 7, epic: 0, primeval: 2, mythic: 0 }
  await render(
    async () => ({ ...currentSeason, summary: { ...currentSeason.summary, items } }),
    undefined
  )

  await act(async () => stat('아이템').focus())

  expect(tooltipRows()).toEqual(['레전더리7개', '태초2개'])
})

it('요약 숫자에 마우스를 올리면 내역이 열리고, 0인 숫자는 내역을 열지 않는다', async () => {
  await render(
    async () => ({ ...currentSeason, summary: { ...currentSeason.summary, legions: [] } }),
    undefined
  )

  await act(async () => hover(stat('레기온')))
  expect(openPopup()).toBeNull()

  await act(async () => hover(stat('레이드')))
  expect(tooltipRows()).toEqual(['가 레이드1,200회', '나 레이드3회'])
})

it('새로고침을 누르면 받아 둔 시즌 활동을 버리고 받는 중을 보인 뒤 같은 시즌을 다시 조회한다', async () => {
  const refreshed = Promise.withResolvers<AdventureActivity>()
  const getAdventureActivity = vi
    .fn<ClientHost['getAdventureActivity']>()
    .mockResolvedValueOnce(previousSeason)
    .mockReturnValueOnce(refreshed.promise)
  await render(getAdventureActivity, 10)

  const refresh = [...container.querySelectorAll('button')].find(
    (button) => button.textContent === '새로고침'
  )!
  await act(async () => refresh.click())
  expect(heroBusy()).toBe('true')

  await act(async () => refreshed.resolve(previousSeason))
  expect(getAdventureActivity.mock.calls).toEqual([
    ['합성 모험단', 10],
    ['합성 모험단', 10]
  ])
  expect(heroBusy()).toBe('false')
})

it('레이드 내역은 하드와 노말이 모두 있으면 둘을 나눠 보이고, 한쪽만 있거나 없는 응답은 합계만 응답 순서대로 보인다', async () => {
  const raids = [
    { name: '가 레이드', count: 55, hard: 24, normal: 31 },
    { name: '나 레이드', count: 3, hard: 3, normal: 0 },
    { name: '다 레이드', count: 7 }
  ]
  await render(
    async () => ({ ...currentSeason, summary: { ...currentSeason.summary, raids } }),
    undefined
  )

  await act(async () => stat('레이드').focus())

  expect(tooltipRows()).toEqual(['가 레이드하드 24회 | 노말 31회', '나 레이드3회', '다 레이드7회'])
})

function primevalLayer(name: string): Element | null {
  return seasonButton(name).querySelector(':scope > i[aria-hidden="true"]')
}

function hasPrimeval(name: string): boolean | undefined {
  return primevalLayer(name)
    ?.className.split(' ')
    .includes(stylex.props(styles.primevalOn).className!)
}

it.each([
  ['받는 중', { done: 12, total: 30, running: true }, false, true],
  ['멈춤', { done: 12, total: 30, running: false }, false, false],
  ['완료', { done: 30, total: 30, running: false }, true, false]
])(
  '옛 시즌 막대는 받는 중일 때만 태초색으로 채우고 테두리는 두지 않는다: %s',
  async (_, backfill, available, primeval) => {
    await render(async () => withBackfill(currentSeason, backfill, available), undefined)

    expect(hasPrimeval('합성 시즌 9')).toBe(primeval)
    expect(seasonButton('합성 시즌 9').querySelectorAll('i[aria-hidden="true"]')).toHaveLength(1)
  }
)

it('받기가 끝나도 같은 태초색 층이 남아 막대 끝까지 채우고 태초색을 끈다', async () => {
  vi.useFakeTimers()
  try {
    const getAdventureActivity = vi
      .fn<ClientHost['getAdventureActivity']>()
      .mockResolvedValueOnce(withBackfill(currentSeason, { done: 24, total: 30, running: true }))
      .mockResolvedValue(withBackfill(currentSeason, { done: 30, total: 30, running: false }, true))
    await render(getAdventureActivity, undefined)
    const layer = primevalLayer('합성 시즌 9')
    expect(hasPrimeval('합성 시즌 9')).toBe(true)

    await act(async () => vi.advanceTimersByTimeAsync(3000))

    expect(primevalLayer('합성 시즌 9')).toBe(layer)
    expect(hasPrimeval('합성 시즌 9')).toBe(false)
    expect(layer?.getAttribute('style')).toMatch(FULL_WIDTH_PATTERN)
  } finally {
    vi.useRealTimers()
  }
})
