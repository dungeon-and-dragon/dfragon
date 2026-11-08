// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type {
  AdventureActivity,
  AdventureActivityDay,
  AdventureActivitySeasonDays
} from '#core/adventure-guild/adventure-activity'
import { useRefreshAdventureActivity } from '../../hooks/useAdventureActivity'
import { ClientHostContext, type ClientHost } from '../../host/client-host'
import { createTestClientHost } from '../../testing/test-support/client-host'
import { TestQueryClient } from '../../testing/test-support/test-query-client'
import { ActivityHeatmap } from './ActivityHeatmap'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.useFakeTimers({ toFake: ['Date'] })
  // 2026-04-10(금) 12:00 KST
  vi.setSystemTime(new Date('2026-04-10T03:00:00.000Z'))
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const activity: AdventureActivity = {
  seasons: [
    { id: 11, name: '합성 시즌 11', startsAt: '2026-03-25T21:00:00.000Z', available: true }
  ],
  season: {
    id: 11,
    startsAt: '2026-03-25T21:00:00.000Z',
    endsAt: null,
    timelineStartsAt: '2026-03-25T21:00:00.000Z'
  },
  summary: {
    raids: [{ name: '가 레이드', count: 2 }],
    legions: [],
    items: { legendary: 8, epic: 1, primeval: 1, mythic: 0 },
    enhancement: {
      attempts: 3,
      amplify: [{ target: 12, attempts: 1, successes: 0 }],
      reinforce: [],
      amplifyBelow10: 2,
      reinforceBelow12: 0,
      refine: 0
    }
  },
  days: [
    {
      date: '2026-04-02',
      raid: 2,
      legion: 0,
      item: 10,
      enhance: 0,
      primeval: true,
      mythic: false,
      highEnhancement: false
    },
    {
      date: '2026-04-03',
      raid: 0,
      legion: 0,
      item: 0,
      enhance: 3,
      primeval: false,
      mythic: false,
      highEnhancement: true
    }
  ]
}

const itemAt = (minute: number) => `2026-04-02T21:${String(minute).padStart(2, '0')}:00+09:00`

const april2: AdventureActivityDay = {
  date: '2026-04-02',
  raids: [{ name: '가 레이드', count: 2 }],
  legions: [],
  items: [
    { at: '2026-04-02T09:58:00+09:00', name: '합성 태초', rarity: '태초' },
    ...Array.from({ length: 9 }, (_, index) => ({
      at: itemAt(index),
      name: `합성 레전더리 ${index + 1}`,
      rarity: '레전더리'
    }))
  ],
  enhancements: [{ at: '2026-04-03T00:29:00+09:00', kind: 'reinforce', target: 15, success: false }]
}

function seasonDays(...days: AdventureActivityDay[]): AdventureActivitySeasonDays {
  return { season: 11, days }
}

function RefreshButton(): React.JSX.Element {
  const refresh = useRefreshAdventureActivity()

  return (
    <button type="button" onClick={() => refresh('합성 모험단')}>
      새로고침
    </button>
  )
}

function render(
  overrides: Partial<Pick<ClientHost, 'getAdventureActivity' | 'getAdventureActivitySeasonDays'>>,
  season?: number
): Promise<void> {
  return act(async () =>
    root.render(
      <ClientHostContext
        value={createTestClientHost({ getAdventureActivity: async () => activity, ...overrides })}
      >
        <TestQueryClient>
          <RefreshButton />
          <ActivityHeatmap adventureName="합성 모험단" season={season} />
        </TestQueryClient>
      </ClientHostContext>
    )
  )
}

function refreshButton(): HTMLButtonElement {
  return [...container.querySelectorAll('button')].find(
    (element) => element.textContent === '새로고침'
  )!
}

function tab(label: string): HTMLButtonElement {
  return [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
    (element) => element.textContent === label
  )!
}

function cell(label: string): HTMLElement {
  return container.querySelector<HTMLElement>(`[role="img"][aria-label^="${label}"]`)!
}

function cellLabels(): string[] {
  return [...container.querySelectorAll('[role="tabpanel"] [role="img"]')]
    .map((element) => element.getAttribute('aria-label') ?? '')
    .filter((label) => label.startsWith('4월 2일') || label.startsWith('4월 3일'))
}

function panelText(): string {
  const text = container.querySelector('[role="tabpanel"]')?.textContent
  if (text == null) {
    return ''
  }

  return text
}

function popupText(): string[] {
  const popup = document.querySelector('[data-base-ui-portal] [data-open][data-base-ui-focusable]')

  return [...(popup?.firstElementChild?.children ?? [])].map((row) => row.textContent ?? '')
}

function hover(element: HTMLElement): void {
  element.dispatchEvent(new MouseEvent('mouseenter'))
}

function leave(element: HTMLElement): void {
  element.dispatchEvent(new MouseEvent('mouseleave'))
}

// 칸을 벗어난 뒤 닫힘 지연을 기다리려고 Base UI가 쓰는 setTimeout까지 가짜로 바꾼다.
function fakeCloseTimers(): void {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'], now: Date.now() })
}

async function waitForClose(): Promise<void> {
  await act(async () => vi.advanceTimersByTime(1000))
}

function stubReducedMotion(reduce: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) =>
    Object.assign(new EventTarget(), {
      matches: query === '(prefers-reduced-motion: no-preference)' ? !reduce : false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {}
    })
  )
}

it('세로 탭은 전체를 고른 채 시작하고, 다른 탭을 누르면 패널 하나만 그 종류의 히트맵으로 바뀐다', async () => {
  await render({})

  const list = container.querySelector('[role="tablist"]')!
  expect(list.getAttribute('aria-orientation')).toBe('vertical')
  expect(tab('전체').getAttribute('aria-selected')).toBe('true')
  expect(container.querySelectorAll('[role="tabpanel"]')).toHaveLength(1)
  expect(cellLabels()).toEqual(['4월 2일 활동 12', '4월 3일 활동 3'])

  await act(async () => tab('아이템').click())
  expect(tab('아이템').getAttribute('aria-selected')).toBe('true')
  expect(container.querySelectorAll('[role="tabpanel"]')).toHaveLength(1)
  expect(cellLabels()).toEqual(['4월 2일 아이템 10, 태초', '4월 3일 아이템 0'])
  expect(panelText()).toContain('레전더리 8에픽 1태초 1')

  await act(async () => tab('강화').click())
  expect(cellLabels()).toEqual([
    '4월 2일 강화 시도 0',
    '4월 3일 강화 시도 3, 10증폭이나 12강 이상 도전'
  ])
})

function scroller(): HTMLElement {
  return container.querySelector('[role="tabpanel"] [role="img"]')!.parentElement!.parentElement!
}

it('처음 그릴 때와 탭을 바꿀 때 칸 영역을 가장 최근 주가 보이는 오른쪽 끝으로 스크롤한다', async () => {
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(640)
  await render({})
  expect(scroller().scrollLeft).toBe(640)

  await act(async () => tab('아이템').click())

  expect(scroller().scrollLeft).toBe(640)
})

it('받아 둔 시즌으로 돌아와도 칸 영역을 다시 오른쪽 끝으로 스크롤한다', async () => {
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(640)
  const previous: AdventureActivity = {
    ...activity,
    season: { ...activity.season!, id: 10 }
  }
  const host = {
    getAdventureActivity: async (_name: string, season: number | undefined) =>
      season === 10 ? previous : activity
  }
  await render(host, 11)
  scroller().scrollLeft = 0

  await render(host, 10)
  scroller().scrollLeft = 0
  await render(host, 11)

  expect(scroller().scrollLeft).toBe(640)
})

it('아이템 탭의 등급 뱃지는 개수가 0인 등급을 그리지 않는다', async () => {
  await render({})
  await act(async () => tab('아이템').click())

  expect(panelText()).toContain('태초 1')
  expect(panelText()).not.toContain('신화')
})

it('네 등급이 모두 0이면 아이템 탭에 등급 뱃지를 그리지 않는다', async () => {
  const noItems = { legendary: 0, epic: 0, primeval: 0, mythic: 0 }
  await render({
    getAdventureActivity: async () => ({
      ...activity,
      summary: { ...activity.summary, items: noItems }
    })
  })
  await act(async () => tab('아이템').click())

  for (const rarity of ['레전더리', '에픽', '태초', '신화']) {
    expect(panelText()).not.toContain(rarity)
  }
})

it('히트맵을 그리면 시즌 하루 상세를 한 번 받고, 받기 전에 칸에 올리면 받는 중을 보이다가 날짜와 묶음 제목은 합계 없이 두고, 8개가 넘는 아이템은 태초 이름과 레전더리 개수로, 강화 단계와 결과를 보인다', async () => {
  const loaded = Promise.withResolvers<AdventureActivitySeasonDays>()
  const getAdventureActivitySeasonDays = vi
    .fn<ClientHost['getAdventureActivitySeasonDays']>()
    .mockReturnValue(loaded.promise)
  await render({ getAdventureActivitySeasonDays })
  expect(getAdventureActivitySeasonDays).toHaveBeenCalledExactlyOnceWith('합성 모험단', 11)

  await act(async () => hover(cell('4월 2일')))
  expect(popupText()).toEqual(['4월 2일 (목)', '하루 활동을 받는 중입니다.', ''])

  await act(async () => loaded.resolve(seasonDays(april2)))
  expect(popupText()).toEqual([
    '4월 2일 (목)',
    '레이드',
    '가 레이드2회',
    '아이템',
    '09:58합성 태초',
    '레전더리9개',
    '강화',
    '00:29+15 실패'
  ])
})

it('시즌 하루 상세를 받은 뒤에는 처음 올리는 칸도 받는 중 없이 그날 기록을 보이고, 여러 칸을 훑어도 다시 요청하지 않는다', async () => {
  const april3: AdventureActivityDay = {
    date: '2026-04-03',
    raids: [],
    legions: [],
    items: [],
    enhancements: [{ at: '2026-04-03T10:00:00+09:00', kind: 'amplify', target: 12, success: true }]
  }
  const getAdventureActivitySeasonDays = vi
    .fn<ClientHost['getAdventureActivitySeasonDays']>()
    .mockResolvedValue(seasonDays(april2, april3))
  await render({ getAdventureActivitySeasonDays })

  await act(async () => hover(cell('4월 3일')))
  expect(popupText()).toEqual(['4월 3일 (금)', '강화', '10:00+12 성공'])

  await act(async () => leave(cell('4월 3일')))
  await act(async () => hover(cell('4월 2일')))
  expect(popupText()[1]).toBe('레이드')
  expect(getAdventureActivitySeasonDays).toHaveBeenCalledTimes(1)
})

it('시즌 하루 상세를 받지 못하면 칸 Tooltip에 오류 문구를 보인다', async () => {
  await render({
    getAdventureActivitySeasonDays: async () => {
      throw new Error('합성 오류 문구')
    }
  })

  await act(async () => hover(cell('4월 2일')))

  expect(popupText()).toEqual(['4월 2일 (목)', '합성 오류 문구'])
})

it('시즌을 바꾸면 그 시즌 하루 상세를 받고, 한 번 받은 시즌으로 돌아가면 다시 요청하지 않는다', async () => {
  const previous: AdventureActivity = { ...activity, season: { ...activity.season!, id: 10 } }
  const getAdventureActivitySeasonDays = vi
    .fn<ClientHost['getAdventureActivitySeasonDays']>()
    .mockImplementation(async (_name, season) => ({ season, days: [] }))
  const host = {
    getAdventureActivity: async (_name: string, season: number | undefined) =>
      season === 10 ? previous : activity,
    getAdventureActivitySeasonDays
  }
  await render(host, 11)
  await render(host, 10)
  await render(host, 11)

  expect(getAdventureActivitySeasonDays.mock.calls).toEqual([
    ['합성 모험단', 11],
    ['합성 모험단', 10]
  ])
})

it('받는 중인 옛 시즌은 3초마다 시즌 활동을 다시 조회해도 하루 상세를 다시 받지 않고, 받기가 끝나면 한 번 다시 받아 새 기록을 보인다', async () => {
  vi.useFakeTimers({ now: Date.now() })
  const withBackfill = (running: boolean): AdventureActivity => ({
    ...activity,
    seasons: [{ ...activity.seasons[0], backfill: { done: running ? 12 : 30, total: 30, running } }]
  })
  const getAdventureActivity = vi
    .fn<ClientHost['getAdventureActivity']>()
    .mockResolvedValueOnce(withBackfill(true))
    .mockResolvedValueOnce(withBackfill(true))
    .mockResolvedValue(withBackfill(false))
  const getAdventureActivitySeasonDays = vi
    .fn<ClientHost['getAdventureActivitySeasonDays']>()
    .mockResolvedValueOnce(seasonDays())
    .mockResolvedValue(seasonDays(april2))
  await render({ getAdventureActivity, getAdventureActivitySeasonDays })

  await act(async () => vi.advanceTimersByTimeAsync(3000))
  expect(getAdventureActivity).toHaveBeenCalledTimes(2)
  expect(getAdventureActivitySeasonDays).toHaveBeenCalledTimes(1)

  await act(async () => vi.advanceTimersByTimeAsync(3000))
  expect(getAdventureActivity).toHaveBeenCalledTimes(3)
  expect(getAdventureActivitySeasonDays).toHaveBeenCalledTimes(2)

  await act(async () => hover(cell('4월 2일')))
  expect(popupText()[1]).toBe('레이드')
})

it('갱신하면 시즌 하루 상세도 다시 받고, 받는 동안 받아 둔 값을 보이다가 새 값으로 바꾼다', async () => {
  const reloaded = Promise.withResolvers<AdventureActivitySeasonDays>()
  const getAdventureActivitySeasonDays = vi
    .fn<ClientHost['getAdventureActivitySeasonDays']>()
    .mockResolvedValueOnce(seasonDays(april2))
    .mockReturnValue(reloaded.promise)
  await render({ getAdventureActivitySeasonDays })

  await act(async () => refreshButton().click())
  await act(async () => hover(cell('4월 2일')))
  expect(getAdventureActivitySeasonDays).toHaveBeenCalledTimes(2)
  expect(popupText()[1]).toBe('레이드')

  await act(async () => reloaded.resolve(seasonDays({ ...april2, raids: [], items: [] })))
  expect(popupText()).toEqual(['4월 2일 (목)', '강화', '00:29+15 실패'])
})

it('탭에 해당하는 묶음만 보이고 탭을 바꿔도 받아 둔 시즌 하루 상세를 다시 쓴다', async () => {
  const allKinds: AdventureActivity = {
    ...activity,
    days: [{ ...activity.days[0]!, legion: 1, enhance: 1 }]
  }
  const detail: AdventureActivityDay = {
    ...april2,
    legions: [{ name: '가 레기온', count: 1 }]
  }
  const getAdventureActivitySeasonDays = vi
    .fn<ClientHost['getAdventureActivitySeasonDays']>()
    .mockResolvedValue(seasonDays(detail))
  await render({ getAdventureActivity: async () => allKinds, getAdventureActivitySeasonDays })

  const date = '4월 2일 (목)'
  const raid = ['레이드', '가 레이드2회']
  const legion = ['레기온', '가 레기온1회']
  const item = ['아이템', '09:58합성 태초', '레전더리9개']
  const enhance = ['강화', '00:29+15 실패']

  await act(async () => hover(cell('4월 2일')))
  expect(popupText()).toEqual([date, ...raid, ...legion, ...item, ...enhance])

  for (const [label, rows] of [
    ['강화', enhance],
    ['레이드', raid],
    ['레기온', legion],
    ['아이템', item]
  ] as const) {
    await act(async () => tab(label).click())
    await act(async () => hover(cell('4월 2일')))
    expect(popupText()).toEqual([date, ...rows])
    expect(getAdventureActivitySeasonDays).toHaveBeenCalledTimes(1)
  }
})

it.each([
  ['레이드', '레이드 클리어'],
  ['레기온', '레기온 클리어'],
  ['강화', '강화 시도']
])(
  '아이템만 있는 날은 %s 탭에서 활동 없는 칸과 같고 Tooltip을 열지 않는다',
  async (label, cellName) => {
    const itemOnly: AdventureActivity = {
      ...activity,
      days: [{ ...activity.days[0]!, raid: 0, primeval: false }]
    }
    await render({
      getAdventureActivity: async () => itemOnly,
      getAdventureActivitySeasonDays: async () => seasonDays(april2)
    })
    await act(async () => tab(label).click())

    const zeroCell = cell('4월 2일')
    expect(zeroCell.getAttribute('aria-label')).toBe(`4월 2일 ${cellName} 0`)
    expect(zeroCell.className).toBe(cell('4월 4일').className)
    await act(async () => hover(zeroCell))

    expect(popupText()).toEqual([])
  }
)

it('강화만 있는 날은 아이템 탭에서 활동 없는 칸과 같고 Tooltip을 열지 않는다', async () => {
  await render({ getAdventureActivitySeasonDays: async () => seasonDays(april2) })
  await act(async () => tab('아이템').click())

  const zeroCell = cell('4월 3일')
  expect(zeroCell.getAttribute('aria-label')).toBe('4월 3일 아이템 0')
  expect(zeroCell.className).toBe(cell('4월 4일').className)
  await act(async () => hover(zeroCell))

  expect(popupText()).toEqual([])
})

it('활동이 있는 칸에서 다른 활동이 있는 칸으로 옮기면 사이 간격을 지나는 동안 툴팁을 닫지 않고 내용을 그 날짜로 바꾼다', async () => {
  await render({
    getAdventureActivitySeasonDays: async () =>
      seasonDays(april2, { ...april2, date: '2026-04-03' })
  })
  await act(async () => hover(cell('4월 2일')))

  await act(async () => leave(cell('4월 2일')))
  expect(popupText()[0]).toBe('4월 2일 (목)')

  await act(async () => hover(cell('4월 3일')))
  expect(popupText()[0]).toBe('4월 3일 (금)')
})

it('칸 영역을 벗어나 머물면 툴팁을 닫는다', async () => {
  await render({ getAdventureActivitySeasonDays: async () => seasonDays(april2) })
  fakeCloseTimers()
  await act(async () => hover(cell('4월 2일')))
  expect(popupText()[0]).toBe('4월 2일 (목)')

  await act(async () => leave(cell('4월 2일')))
  await waitForClose()

  expect(popupText()).toEqual([])
})

it('활동이 없는 날은 마우스를 올려도 Tooltip을 열지 않는다', async () => {
  await render({ getAdventureActivitySeasonDays: async () => seasonDays(april2) })

  await act(async () => hover(cell('4월 4일')))

  expect(cell('4월 4일').getAttribute('aria-label')).toBe('4월 4일 활동 0')
  expect(popupText()).toEqual([])
})

function ringAngle(): string | undefined {
  return container
    .querySelector<HTMLElement>('[role="tabpanel"] [role="img"]')
    ?.parentElement?.style.getPropertyValue('--heatmap-ring-angle')
}

it('특별한 날이 있는 탭은 테두리 각도를 돌리고, 움직임 줄이기 설정이면 돌리지 않는다', async () => {
  stubReducedMotion(false)
  await render({})
  expect(ringAngle()).toBe('')

  await act(async () => tab('아이템').click())
  expect(ringAngle()).not.toBe('')

  await act(async () => root.unmount())
  root = createRoot(container)
  stubReducedMotion(true)
  await render({})
  await act(async () => tab('아이템').click())
  expect(ringAngle()).toBe('')
})

it('칸의 레이드 줄은 하드와 노말이 모두 있으면 둘을 나눠 보이고, 한쪽만 있거나 없는 응답은 합계만 응답 순서대로 보인다', async () => {
  const raids = [
    { name: '가 레이드', count: 2, hard: 1, normal: 1 },
    { name: '나 레이드', count: 4, hard: 0, normal: 4 },
    { name: '다 레이드', count: 6 }
  ]
  await render({
    getAdventureActivitySeasonDays: async () =>
      seasonDays({ ...april2, raids, items: [], enhancements: [] })
  })

  await act(async () => hover(cell('4월 2일')))

  expect(popupText().slice(1, 5)).toEqual([
    '레이드',
    '가 레이드하드 1회 | 노말 1회',
    '나 레이드4회',
    '다 레이드6회'
  ])
})
