// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type {
  ClearContent,
  ClearContentStats,
  ClearStats,
  ClearWeek
} from '#core/ranking/clear-stats'
import { type ClientHost, ClientHostContext } from '../../host/client-host'
import { createTestClientHost } from '../../testing/test-support/client-host'
import { TestQueryClient } from '../../testing/test-support/test-query-client'
import type { ClearSearch } from './clear-search'
import { ClearsScreen } from './ClearsScreen'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  // 2026-11-10 14:00 KST. 타이머는 그대로 두고 지금 시각만 고정한다.
  vi.useFakeTimers({ now: new Date('2026-11-10T05:00:00.000Z'), toFake: ['Date'] })
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

function week(weekStart: string, cleared: number, overrides: Partial<ClearWeek> = {}): ClearWeek {
  return {
    weekStart,
    closed: true,
    collectedAt: '2026-11-09T20:12:00.000Z',
    population: 1000,
    minFame: 125871,
    cleared,
    newlyCleared: null,
    ratios: [
      { ratio: null, cleared: cleared - 10 },
      { ratio: 50, cleared: 10 }
    ],
    ...overrides
  }
}

const RAID_RELEASE = '2026-08-05T21:00:00.000Z'

const raid: ClearContent = {
  id: 'michaela-hard',
  kind: 'raid',
  name: '무너진 성자 미카엘라 (하드)',
  releasedAt: RAID_RELEASE,
  latest: true,
  weeks: [week('2026-10-29', 200), week('2026-11-05', 100, { closed: false })]
}

const challenge: ClearContent = {
  id: 'nightmare',
  kind: 'challenge',
  name: '각인된 악몽 챌린지',
  releasedAt: '2026-11-04T21:00:00.000Z',
  latest: true,
  weeks: [
    week('2026-11-05', 69, {
      closed: false,
      newlyCleared: 69,
      ratios: [{ ratio: null, cleared: 69 }]
    })
  ]
}

const oldRaid: ClearContent = {
  id: 'diregie-hard',
  kind: 'raid',
  name: '디레지에 레이드 (하드)',
  releasedAt: '2026-02-04T21:00:00.000Z',
  latest: false,
  weeks: [week('2026-02-05', 82, { collectedAt: '2026-02-11T20:00:00.000Z' })]
}

const unseen: ClearContent = {
  id: 'nabel-normal',
  kind: 'raid',
  name: '만들어진 신 나벨 (일반)',
  releasedAt: '2025-04-16T21:00:00.000Z',
  latest: false,
  weeks: []
}

const stats: ClearStats = { contents: [unseen, oldRaid, raid, challenge] }

function detailOf(content: ClearContent, weekStart: string | undefined): ClearContentStats {
  const { weeks, ...header } = content
  const selected = weeks.find((candidate) => candidate.weekStart === weekStart) ?? null
  const jobs = Array.from({ length: 12 }, (_, index) => ({
    jobId: `job-${index}`,
    jobGrowId: `grow-${index}`,
    jobName: `직업${index}`,
    jobGrowName: `眞 전직${index}`,
    population: 100,
    cleared: index
  }))

  return {
    ...header,
    week: selected,
    jobs,
    adventures: [
      { characters: 1, adventures: 40 },
      { characters: 2, adventures: 3 }
    ]
  }
}

type Loaders = Partial<Pick<ClientHost, 'getClearStats' | 'getClearContentStats'>>

function render(
  search: ClearSearch,
  {
    getClearStats = async () => stats,
    getClearContentStats = vi.fn(async (contentId: string, weekStart: string | undefined) =>
      detailOf(stats.contents.find(({ id }) => id === contentId)!, weekStart)
    )
  }: Loaders = {},
  onSearchChange: (search: ClearSearch) => void = () => {}
): Promise<void> {
  return act(async () =>
    root.render(
      <ClientHostContext value={createTestClientHost({ getClearStats, getClearContentStats })}>
        <TestQueryClient>
          <ClearsScreen search={search} onSearchChange={onSearchChange} />
        </TestQueryClient>
      </ClientHostContext>
    )
  )
}

function boxOf(name: string): HTMLElement {
  return container.querySelector<HTMLElement>(`section[aria-label="${name}"]`)!
}

function rowsOf(name: string): string[][] {
  return [...boxOf(name).querySelectorAll('ul > li')].map((row) =>
    [...row.children].map((cell) => cell.textContent ?? '')
  )
}

function buttonNamed(name: string): HTMLButtonElement {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) => (button.getAttribute('aria-label') ?? button.textContent) === name
  )!
}

function click(element: Element): Promise<void> {
  return act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

it('받는 중에는 제목 줄만 둔다', async () => {
  await render({}, { getClearStats: () => new Promise<never>(() => {}) })

  expect(container.querySelector('header')?.textContent).toBe('클리어 집계')
  expect(container.querySelectorAll('section')).toHaveLength(0)
  expect(container.querySelector('[role="status"]')?.textContent).toBe(
    '클리어 집계를 받는 중입니다.'
  )
})

it('조회가 실패하면 제목 줄과 오류 한 줄을 둔다', async () => {
  await render(
    {},
    {
      getClearStats: async () => {
        throw new Error('클리어 집계를 받지 못했습니다.')
      }
    }
  )

  expect(container.querySelector('header')?.textContent).toBe('클리어 집계')
  expect(container.querySelector('[role="alert"]')?.textContent).toBe(
    '클리어 집계를 받지 못했습니다.'
  )
})

it('주소에 컨텐츠가 없으면 최신 레이드의 마지막 주를 열고 모집단, 최저 명성, 수집 시각과 클리어 수, 비율을 보인다', async () => {
  const getClearContentStats = vi.fn(async (_contentId: string, weekStart: string | undefined) =>
    detailOf(raid, weekStart)
  )
  await render({}, { getClearContentStats })

  expect(container.querySelector('header')?.textContent).toBe(
    '클리어 집계모집단명성 상위 1,000최저 명성125,871수집 시각11-10 05:12'
  )
  expect(
    [...boxOf('컨텐츠').querySelectorAll('h2')].map((row) => row.parentElement?.textContent)
  ).toEqual([
    '레이드무너진 성자 미카엘라 (하드)',
    '챌린지각인된 악몽 챌린지',
    '지난 컨텐츠디레지에 레이드 (하드)만들어진 신 나벨 (일반)'
  ])
  expect(buttonNamed('무너진 성자 미카엘라 (하드)').getAttribute('aria-pressed')).toBe('true')
  const hero = boxOf('클리어')
  expect(hero.querySelector('h2')?.textContent).toBe('무너진 성자 미카엘라 (하드)')
  expect(hero.textContent).toContain('출시 2026-08-06')
  expect([...hero.querySelectorAll('dt, dd')].map((cell) => cell.textContent)).toEqual([
    '클리어 캐릭터',
    '100',
    '클리어 비율',
    '10.0%'
  ])
  expect(hero.textContent).toContain('집계 중')
  expect(buttonNamed('14주차 11-05 ~ 11-11')).toBeDefined()
  expect(getClearContentStats).toHaveBeenCalledWith('michaela-hard', '2026-11-05')
})

it('받은 주가 둘 이상이면 주차별 막대를 두고 고른 주의 클리어 수와 비율을 띄운다', async () => {
  await render({})

  const columns = [...boxOf('클리어').querySelectorAll('ul > li')]
  expect(columns.map((column) => column.firstElementChild?.textContent)).toEqual([
    '13주차 10-29 200 20.0%',
    '14주차 11-05 100 10.0%'
  ])
  expect(boxOf('클리어').querySelector('ul + [aria-hidden="true"]')?.textContent).toBe(
    '14주차 11-05100  10.0%'
  )
})

it('레이드는 배율별 클리어와 모험단별 분포를 나란히 둔다', async () => {
  await render({})

  expect(rowsOf('배율별 클리어').map(([name, , value]) => [name, value])).toEqual([
    ['기본', '90'],
    ['150%', '10']
  ])
  expect(rowsOf('모험단별 분포').map(([name, , value]) => [name, value])).toEqual([
    ['1명', '40'],
    ['2명', '3']
  ])
})

it('직업별 클리어는 클리어율 순 10줄만 보이고 모두 보기를 누르면 펼치며 클리어 순으로 바꿀 수 있다', async () => {
  await render({})

  const names = () =>
    [...boxOf('직업별 클리어').querySelectorAll('tbody th')].map((cell) => cell.textContent)
  expect(names()).toHaveLength(10)
  expect(names()[0]).toBe('眞 전직11')
  const firstRow = boxOf('직업별 클리어').querySelector('tbody tr')!
  expect([...firstRow.children].map((cell) => cell.textContent)).toEqual([
    '眞 전직11',
    '',
    '100',
    '11',
    '11.0%'
  ])

  await click(buttonNamed('전직 12개 모두 보기'))
  expect(names()).toHaveLength(12)
  expect(buttonNamed('전직 12개 모두 보기')).toBeUndefined()

  await click(buttonNamed('클리어 순'))
  expect(buttonNamed('클리어 순').getAttribute('aria-pressed')).toBe('true')
  expect(names().at(-1)).toBe('眞 전직0')
})

it('챌린지는 이번 주 신규를 보이고 배율별 클리어 칸이 없으며 받은 주가 하나면 주차별 막대가 없다', async () => {
  await render({ content: 'nightmare' })

  const hero = boxOf('클리어')
  expect(hero.querySelector('h2')?.previousElementSibling?.textContent).toBe('챌린지')
  expect([...hero.querySelectorAll('dt')].map((cell) => cell.textContent)).toEqual([
    '클리어 캐릭터',
    '클리어 비율',
    '이번 주 신규'
  ])
  expect(hero.querySelector('ul')).toBeNull()
  expect(boxOf('배율별 클리어')).toBeNull()
  expect(boxOf('모험단별 분포')).not.toBeNull()
  expect(buttonNamed('이전 주').disabled).toBe(true)
  expect(buttonNamed('다음 주').disabled).toBe(true)
})

it('지난 컨텐츠를 고르면 종류를 지난 컨텐츠로 쓰고 받아 둔 주를 고를 수 있다', async () => {
  await render({ content: 'diregie-hard' })

  expect(boxOf('클리어').textContent).toContain('지난 컨텐츠디레지에 레이드 (하드)출시 2026-02-05')
  expect(boxOf('클리어').textContent).not.toContain('집계 중')
  expect(buttonNamed('1주차 02-05 ~ 02-11')).toBeDefined()
  expect(container.querySelector('header')?.textContent).toContain('수집 시각02-12 05:00')
})

it('수집 기록이 없는 컨텐츠는 요약 머리 아래 한 줄만 두고 집계를 부르지 않는다', async () => {
  const getClearContentStats = vi.fn(() => new Promise<never>(() => {}))
  await render({ content: 'nabel-normal' }, { getClearContentStats })

  expect(container.querySelector('header')?.textContent).toBe('클리어 집계')
  expect(boxOf('클리어').textContent).toBe(
    '지난 컨텐츠만들어진 신 나벨 (일반)출시 2025-04-17수집 기록이 없습니다.'
  )
  expect(boxOf('직업별 클리어')).toBeNull()
  expect(getClearContentStats).not.toHaveBeenCalled()
})

it('컨텐츠를 고르면 주를 비운 주소로, 이전 주를 누르면 그 주 주소로 바꾼다', async () => {
  const onSearchChange = vi.fn()
  await render({}, {}, onSearchChange)

  await click(buttonNamed('각인된 악몽 챌린지'))
  expect(onSearchChange).toHaveBeenLastCalledWith({ content: 'nightmare' })

  await click(buttonNamed('이전 주'))
  expect(onSearchChange).toHaveBeenLastCalledWith({ content: 'michaela-hard', week: '2026-10-29' })
})

it('주소의 주가 저장된 주면 그 주를 연다', async () => {
  const getClearContentStats = vi.fn(async (_contentId: string, weekStart: string | undefined) =>
    detailOf(raid, weekStart)
  )
  await render({ content: 'michaela-hard', week: '2026-10-29' }, { getClearContentStats })

  expect(buttonNamed('13주차 10-29 ~ 11-04')).toBeDefined()
  expect(buttonNamed('다음 주').disabled).toBe(false)
  expect(getClearContentStats).toHaveBeenCalledWith('michaela-hard', '2026-10-29')
})

it('달력은 기록이 있는 주의 지난 날짜만 누를 수 있고 날짜를 누르면 그 날짜가 든 주로 바꾼다', async () => {
  const onSearchChange = vi.fn()
  await render({}, {}, onSearchChange)

  await click(buttonNamed('14주차 11-05 ~ 11-11'))
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
  expect(dialog.querySelector('h2')?.textContent).toBe('2026년 11월')
  expect(
    [...dialog.querySelectorAll('tbody tr')].map((row) => row.firstElementChild?.textContent)
  ).toEqual(['13', '14', '', '', ''])
  expect(buttonNamed('11월 10일').disabled).toBe(false)
  expect(buttonNamed('11월 11일').disabled).toBe(true)
  expect(buttonNamed('11월 12일').disabled).toBe(true)
  expect(buttonNamed('이전 달').disabled).toBe(true)
  expect(buttonNamed('다음 달').disabled).toBe(true)

  await click(buttonNamed('11월 1일'))
  expect(onSearchChange).toHaveBeenLastCalledWith({ content: 'michaela-hard', week: '2026-10-29' })
})

it('컨텐츠 집계가 실패하면 오류 한 줄을 둔다', async () => {
  await render(
    {},
    {
      getClearContentStats: async () => {
        throw new Error('응답 형식이 맞지 않습니다.')
      }
    }
  )

  expect(container.querySelector('[role="alert"]')?.textContent).toBe('응답 형식이 맞지 않습니다.')
  expect(boxOf('배율별 클리어')).not.toBeNull()
})
