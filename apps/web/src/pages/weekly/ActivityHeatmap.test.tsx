// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type {
  AdventureActivity,
  AdventureActivityDay
} from '#core/adventure-guild/adventure-activity'
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

function render(
  overrides: Partial<Pick<ClientHost, 'getAdventureActivity' | 'getAdventureActivityDay'>>,
  season?: number
): Promise<void> {
  return act(async () =>
    root.render(
      <ClientHostContext
        value={createTestClientHost({ getAdventureActivity: async () => activity, ...overrides })}
      >
        <TestQueryClient>
          <ActivityHeatmap adventureName="합성 모험단" season={season} />
        </TestQueryClient>
      </ClientHostContext>
    )
  )
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

it('칸에 처음 마우스를 올리면 그날 상세를 받아 날짜와 묶음 제목은 합계 없이 두고, 8개가 넘는 아이템은 태초 이름과 레전더리 개수로, 강화 단계와 결과를 보이고, 다시 올리면 받은 상세를 다시 쓴다', async () => {
  const loaded = Promise.withResolvers<AdventureActivityDay>()
  const getAdventureActivityDay = vi
    .fn<ClientHost['getAdventureActivityDay']>()
    .mockReturnValue(loaded.promise)
  await render({ getAdventureActivityDay })
  expect(getAdventureActivityDay).not.toHaveBeenCalled()

  await act(async () => hover(cell('4월 2일')))
  expect(getAdventureActivityDay).toHaveBeenCalledWith('합성 모험단', '2026-04-02')
  expect(popupText()).toEqual(['4월 2일 (목)', '하루 활동을 받는 중입니다.', ''])

  await act(async () => loaded.resolve(april2))
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

  fakeCloseTimers()
  await act(async () => leave(cell('4월 2일')))
  await waitForClose()
  expect(popupText()).toEqual([])
  await act(async () => hover(cell('4월 2일')))
  expect(getAdventureActivityDay).toHaveBeenCalledTimes(1)
})

it('탭에 해당하는 묶음만 보이고 같은 날짜의 상세를 탭을 바꿔도 다시 쓴다', async () => {
  const allKinds: AdventureActivity = {
    ...activity,
    days: [{ ...activity.days[0]!, legion: 1, enhance: 1 }]
  }
  const detail: AdventureActivityDay = {
    ...april2,
    legions: [{ name: '가 레기온', count: 1 }]
  }
  const getAdventureActivityDay = vi.fn<ClientHost['getAdventureActivityDay']>(async () => detail)
  await render({ getAdventureActivity: async () => allKinds, getAdventureActivityDay })

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
    expect(getAdventureActivityDay).toHaveBeenCalledTimes(1)
  }
})

it.each([
  ['레이드', '레이드 클리어'],
  ['레기온', '레기온 클리어'],
  ['강화', '강화 시도']
])(
  '아이템만 있는 날은 %s 탭에서 활동 없는 칸과 같고 상세를 받지 않는다',
  async (label, cellName) => {
    const itemOnly: AdventureActivity = {
      ...activity,
      days: [{ ...activity.days[0]!, raid: 0, primeval: false }]
    }
    const getAdventureActivityDay = vi.fn<ClientHost['getAdventureActivityDay']>()
    await render({ getAdventureActivity: async () => itemOnly, getAdventureActivityDay })
    await act(async () => tab(label).click())

    const zeroCell = cell('4월 2일')
    expect(zeroCell.getAttribute('aria-label')).toBe(`4월 2일 ${cellName} 0`)
    expect(zeroCell.className).toBe(cell('4월 4일').className)
    await act(async () => hover(zeroCell))

    expect(popupText()).toEqual([])
    expect(getAdventureActivityDay).not.toHaveBeenCalled()
  }
)

it('강화만 있는 날은 아이템 탭에서 활동 없는 칸과 같고 상세를 받지 않는다', async () => {
  const getAdventureActivityDay = vi.fn<ClientHost['getAdventureActivityDay']>()
  await render({ getAdventureActivityDay })
  await act(async () => tab('아이템').click())

  const zeroCell = cell('4월 3일')
  expect(zeroCell.getAttribute('aria-label')).toBe('4월 3일 아이템 0')
  expect(zeroCell.className).toBe(cell('4월 4일').className)
  await act(async () => hover(zeroCell))

  expect(popupText()).toEqual([])
  expect(getAdventureActivityDay).not.toHaveBeenCalled()
})

it('활동이 있는 칸에서 다른 활동이 있는 칸으로 옮기면 사이 간격을 지나는 동안 툴팁을 닫지 않고 내용을 그 날짜로 바꾼다', async () => {
  await render({ getAdventureActivityDay: async (_name, date) => ({ ...april2, date }) })
  await act(async () => hover(cell('4월 2일')))

  await act(async () => leave(cell('4월 2일')))
  expect(popupText()[0]).toBe('4월 2일 (목)')

  await act(async () => hover(cell('4월 3일')))
  expect(popupText()[0]).toBe('4월 3일 (금)')
})

it('칸 영역을 벗어나 머물면 툴팁을 닫는다', async () => {
  await render({ getAdventureActivityDay: async () => april2 })
  fakeCloseTimers()
  await act(async () => hover(cell('4월 2일')))
  expect(popupText()[0]).toBe('4월 2일 (목)')

  await act(async () => leave(cell('4월 2일')))
  await waitForClose()

  expect(popupText()).toEqual([])
})

it('활동이 없는 날은 마우스를 올려도 상세를 받지 않는다', async () => {
  const getAdventureActivityDay = vi.fn<ClientHost['getAdventureActivityDay']>()
  await render({ getAdventureActivityDay })

  await act(async () => hover(cell('4월 4일')))

  expect(cell('4월 4일').getAttribute('aria-label')).toBe('4월 4일 활동 0')
  expect(getAdventureActivityDay).not.toHaveBeenCalled()
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
    getAdventureActivityDay: async () => ({ ...april2, raids, items: [], enhancements: [] })
  })

  await act(async () => hover(cell('4월 2일')))

  expect(popupText().slice(1, 5)).toEqual([
    '레이드',
    '가 레이드하드 1회 | 노말 1회',
    '나 레이드4회',
    '다 레이드6회'
  ])
})
