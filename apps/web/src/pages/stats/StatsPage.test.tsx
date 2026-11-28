// @vitest-environment jsdom
import { HttpResponse, http } from 'msw'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CharacterStats } from '#entities/ranking'
import { server } from '#testing/test-support/msw-server'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { TestRouter } from '#testing/test-support/test-router'
import { CHARACTER_STATS_URL, characterStatsHandlers } from './api/stats.handlers'
import { StatsPage } from './StatsPage'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  // 2026-11-06 12:00 KST. 타이머는 그대로 두고 지금 시각만 고정한다.
  vi.useFakeTimers({ now: new Date('2026-11-06T03:00:00.000Z'), toFake: ['Date'] })
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

const stats: CharacterStats = {
  computedAt: '2026-11-05T15:30:00.000Z',
  total: 1234567,
  servers: [
    { serverId: 'cain', count: 600 },
    { serverId: 'bakal', count: 300 }
  ],
  jobs: [
    {
      jobId: 'job-1',
      jobGrowId: 'grow-1',
      jobName: '직업1',
      jobGrowName: '眞 전직1',
      count: 400,
      fameBuckets: [
        { from: 70000, to: 80000, count: 150 },
        { from: 80000, to: 90000, count: 100 },
        { from: 120000, to: 130000, count: 30 },
        { from: 130000, to: 140000, count: 20 }
      ]
    },
    {
      jobId: 'job-1',
      jobGrowId: 'grow-2',
      jobName: '직업1',
      jobGrowName: '眞 전직2',
      count: 200,
      fameBuckets: [{ from: 90000, to: 100000, count: 200 }]
    },
    {
      jobId: 'job-2',
      jobGrowId: 'grow-3',
      jobName: '직업2',
      jobGrowName: '眞 전직3',
      count: 100,
      fameBuckets: []
    }
  ],
  fameDistribution: [
    { from: 70000, to: 71000, count: 10 },
    { from: 121000, to: 122000, count: 66392 }
  ]
}

async function mount(): Promise<void> {
  await act(async () =>
    root.render(
      <TestQueryClient>
        <TestRouter>
          <StatsPage />
        </TestRouter>
      </TestQueryClient>
    )
  )
  await vi.waitFor(() => expect(container.querySelector('[aria-busy="true"]')).toBeNull())
}

function render(body: CharacterStats): Promise<void> {
  server.use(http.get(CHARACTER_STATS_URL, () => HttpResponse.json(body)))

  return mount()
}

function boxOf(name: string): HTMLElement {
  return container.querySelector<HTMLElement>(`section[aria-label="${name}"]`)!
}

function rowsOf(name: string): string[][] {
  return [...boxOf(name).querySelectorAll('li:not([aria-hidden])')].map((row) =>
    [...row.children].map((cell) => cell.textContent ?? '')
  )
}

it('제목 상자 없이 통계 상자만 그린다', async () => {
  await render(stats)

  expect(container.querySelector('header')).toBeNull()
})

it('큰 수는 줄여 쓰고 서버 인구 없이 명성 분포, 직업별 명성 상자를 한 줄씩 그린다', async () => {
  await render(stats)

  expect([...container.querySelectorAll('h2')].map((name) => name.textContent)).toEqual([
    '명성 분포',
    '직업별 명성'
  ])
  expect(
    [...container.querySelectorAll('section[aria-label]')].map(
      (box) => box.parentElement?.querySelectorAll(':scope > section').length
    )
  ).toEqual([1, 1])
  expect(rowsOf('명성 분포')).toEqual([
    ['', '0'],
    ['', '4만'],
    ['', '8만'],
    ['', '12만'],
    ['', '']
  ])
})

function tooltipOf(name: string): HTMLElement | null {
  return boxOf(name).querySelector<HTMLElement>('ul + [aria-hidden="true"]')
}

function tooltipText(name: string): string | null {
  const tooltip = tooltipOf(name)!
  if (tooltip.style.visibility === 'hidden') {
    return null
  }

  return tooltip.textContent
}

function moveMouse(from: Element, to: Element): Promise<void> {
  return act(async () => {
    from.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: to }))
    to.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: from }))
  })
}

it('명성 분포는 4만 막대와 1천 막대 사이에 구분선을 두고 막대에 마우스를 올릴 때만 구간과 인원을 띄운다', async () => {
  await render(stats)

  const items = [...boxOf('명성 분포').querySelectorAll('li')]
  expect(items.map((item) => item.getAttribute('aria-hidden'))).toEqual([
    null,
    null,
    null,
    'true',
    null,
    null
  ])
  expect(tooltipText('명성 분포')).toBeNull()

  const fineBar = items.at(-1)!
  await moveMouse(document.body, fineBar)
  expect(tooltipText('명성 분포')).toBe('12.1만~12.2만66,392')

  await moveMouse(fineBar, document.body)
  expect(tooltipText('명성 분포')).toBeNull()
})

it('명성 분포는 12만~13만 막대와 13만 이상 막대 사이에도 구분선을 둔다', async () => {
  await render({
    ...stats,
    fameDistribution: [
      { from: 128000, to: 129000, count: 10 },
      { from: 129000, to: 130000, count: 20 },
      { from: 130000, to: 131000, count: 1 }
    ]
  })

  const items = [...boxOf('명성 분포').querySelectorAll('li')]
  const dividerIndexes = items.flatMap((item, index) =>
    item.getAttribute('aria-hidden') === 'true' ? [index] : []
  )

  expect(items).toHaveLength(3 + 1 + 10 + 1 + 1)
  expect(dividerIndexes).toEqual([3, 14])
})

it('명성 분포 막대 사이 간격과 구분선을 지나도 툴팁을 닫지 않고 다음 막대의 구간과 인원으로 바꾼다', async () => {
  await render(stats)

  const chart = boxOf('명성 분포').querySelector('ul')!
  const [, coarseBar, , divider, firstFineBar] = [...chart.querySelectorAll('li')]
  await moveMouse(document.body, coarseBar!)
  expect(tooltipText('명성 분포')).toBe('4만~8만10')

  await moveMouse(coarseBar!, chart)
  await moveMouse(chart, divider!)
  expect(tooltipText('명성 분포')).toBe('4만~8만10')

  await moveMouse(divider!, firstFineBar!)
  expect(tooltipText('명성 분포')).toBe('12만~12.1만0')

  await moveMouse(firstFineBar!, document.body)
  expect(tooltipText('명성 분포')).toBeNull()
})

function jobNamesOf(): string[] {
  return [...boxOf('직업별 명성').querySelectorAll('svg text[text-anchor="middle"]')].map(
    (tick) => tick.textContent ?? ''
  )
}

function legendOf(name: string): HTMLButtonElement {
  return [...boxOf('직업별 명성').querySelectorAll('button')].find(
    (button) => button.textContent === name
  )!
}

it('직업별 명성은 각성 전직마다 막대를 두고 眞이 붙지 않은 전직은 뺀다', async () => {
  await render({
    ...stats,
    jobs: [
      ...stats.jobs,
      { ...stats.jobs[2]!, jobGrowId: 'grow-4', jobGrowName: '전직4', count: 500, fameBuckets: [] }
    ]
  })

  expect(jobNamesOf()).toEqual(['전직1', '전직2', '전직3'])
})

it('직업별 명성 막대에 전직명을 쓰고 동명 전직에만 성별을 붙인다', async () => {
  await render({
    ...stats,
    jobs: [
      { ...stats.jobs[0]!, jobName: '격투가(남)', jobGrowName: '眞 넨마스터' },
      { ...stats.jobs[1]!, jobName: '격투가(여)', jobGrowName: '眞 넨마스터' },
      { ...stats.jobs[2]!, jobName: '귀검사(남)', jobGrowName: '眞 웨펀마스터' }
    ]
  })

  expect(jobNamesOf()).toEqual(['넨마스터(남)', '넨마스터(여)', '웨펀마스터'])
})

it('직업별 명성 범례를 누르면 그 구간에 취소선을 긋고 다시 누르면 되돌린다', async () => {
  await render(stats)

  const legend = legendOf('8만 미만')
  expect(legend.getAttribute('aria-pressed')).toBe('true')

  await act(async () => legend.click())
  expect(legend.getAttribute('aria-pressed')).toBe('false')
  expect(legend.className).toContain('line-through')

  await act(async () => legend.click())
  expect(legend.getAttribute('aria-pressed')).toBe('true')
  expect(legend.className).not.toContain('line-through')
})

it('빈 통계는 상자마다 이름 한 줄만 둔다', async () => {
  await render({
    ...stats,
    total: 0,
    servers: [],
    jobs: [],
    fameDistribution: []
  })

  expect(container.querySelectorAll('li')).toHaveLength(0)
  expect(boxOf('명성 분포').textContent).toBe('명성 분포')
  expect(boxOf('직업별 명성').textContent).toBe('직업별 명성')
})

it('집계 시각이 null인 빈 통계도 오류 없이 표시한다', async () => {
  await render({
    computedAt: null,
    total: 0,
    servers: [],
    jobs: [],
    fameDistribution: []
  })

  expect(container.querySelector('header')).toBeNull()
  expect(container.querySelector('[role="alert"]')).toBeNull()
})

it('조회가 실패하면 오류를 알린다', async () => {
  server.use(characterStatsHandlers.failure)
  await mount()

  expect(container.querySelector('[role="alert"]')?.textContent).toBe('통계를 받지 못했습니다.')
})
