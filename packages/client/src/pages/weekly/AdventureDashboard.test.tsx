// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { AdventureActivity } from '@dfragon/client-core/shared/adventure-guild/adventure-activity'
import { ClientHostContext, type ClientHost } from '../../hooks/useClientHost'
import { useMyAdventureStore } from '../../hooks/useMyAdventureStore'
import { createTestClientHost } from '../../testing/test-support/client-host'
import { TestQueryClient } from '../../testing/test-support/test-query-client'
import { TestRouter } from '../../testing/test-support/test-router'
import { WeeklyScreen } from './WeeklyScreen'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  useMyAdventureStore.setState({ adventureName: '합성 모험단' })
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
  useMyAdventureStore.setState({ adventureName: null })
  localStorage.clear()
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
  season: { id: 11, startsAt: '2026-03-25T21:00:00.000Z', endsAt: null },
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
  season: { id: 10, startsAt: '2025-01-08T21:00:00.000Z', endsAt: '2026-03-25T21:00:00.000Z' },
  summary: { ...emptySummary, raids: [{ name: '라 레이드', count: 9 }] }
}

function render(
  getAdventureActivity: ClientHost['getAdventureActivity'],
  season: number | undefined,
  onSeasonChange: (season: number) => void = vi.fn()
): Promise<void> {
  return act(async () =>
    root.render(
      <ClientHostContext value={createTestClientHost({ getAdventureActivity })}>
        <TestQueryClient>
          <TestRouter>
            <WeeklyScreen season={season} onSeasonChange={onSeasonChange} />
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

function heroBusy(): string | null | undefined {
  return container.querySelector('h1')?.closest('[aria-busy]')?.getAttribute('aria-busy')
}

it('시즌을 고르지 않으면 지금 시즌을 받아 시즌 이름, 시작일과 요약 숫자 4개를 보인다', async () => {
  const getAdventureActivity = vi.fn<ClientHost['getAdventureActivity']>(async () => currentSeason)
  await render(getAdventureActivity, undefined)

  expect(getAdventureActivity).toHaveBeenCalledWith('합성 모험단', undefined)
  expect(container.querySelector('h1')?.textContent).toBe('합성 모험단')
  expect(currentSeasonName()).toBe('합성 시즌 11시즌 11, 2026')
  expect(container.textContent).toContain('시즌 11합성 시즌 112026.03.26 ~')
  expect(statValues()).toEqual(['1,203', '5', '14', '40'])
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
  expect(currentSeasonName()).toBe('합성 시즌 10시즌 10, 2025')
  expect(container.textContent).toContain('시즌 10합성 시즌 102025.01.09 ~')
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
  expect(currentSeasonName()).toBe('합성 시즌 11시즌 11, 2026')
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
