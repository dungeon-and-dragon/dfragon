// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type {
  AdventureActivity,
  AdventureActivityDay
} from '@dfragon/client-core/shared/adventure-guild/adventure-activity'
import { ClientHostContext, type ClientHost } from '../../hooks/useClientHost'
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
  overrides: Partial<Pick<ClientHost, 'getAdventureActivity' | 'getAdventureActivityDay'>>
): Promise<void> {
  return act(async () =>
    root.render(
      <ClientHostContext
        value={createTestClientHost({ getAdventureActivity: async () => activity, ...overrides })}
      >
        <TestQueryClient>
          <ActivityHeatmap adventureName="합성 모험단" season={undefined} />
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

it('칸에 처음 마우스를 올리면 그날 상세를 받아 8개가 넘는 아이템은 태초 이름과 레전더리 개수로, 강화 단계와 결과를 보이고, 다시 올리면 받은 상세를 다시 쓴다', async () => {
  const loaded = Promise.withResolvers<AdventureActivityDay>()
  const getAdventureActivityDay = vi
    .fn<ClientHost['getAdventureActivityDay']>()
    .mockReturnValue(loaded.promise)
  await render({ getAdventureActivityDay })
  expect(getAdventureActivityDay).not.toHaveBeenCalled()

  await act(async () => hover(cell('4월 2일')))
  expect(getAdventureActivityDay).toHaveBeenCalledWith('합성 모험단', '2026-04-02')
  expect(popupText()).toEqual(['4월 2일 (목)12회', '하루 활동을 받는 중입니다.', ''])

  await act(async () => loaded.resolve(april2))
  expect(popupText()).toEqual([
    '4월 2일 (목)12회',
    '레이드2회',
    '가 레이드2회',
    '아이템10개',
    '09:58합성 태초',
    '레전더리9개',
    '강화1회',
    '00:29+15 실패'
  ])

  await act(async () => leave(cell('4월 2일')))
  await act(async () => hover(cell('4월 2일')))
  expect(getAdventureActivityDay).toHaveBeenCalledTimes(1)
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
