// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CharacterStats } from '#core/ranking/ranking-stats'
import { ClientHostContext } from '../../host/client-host'
import { createTestClientHost } from '../../testing/test-support/client-host'
import { TestQueryClient } from '../../testing/test-support/test-query-client'
import { StatsScreen } from './StatsScreen'

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
      averageFame: 80000
    },
    {
      jobId: 'job-1',
      jobGrowId: 'grow-2',
      jobName: '직업1',
      jobGrowName: '眞 전직2',
      count: 200,
      averageFame: 90000
    },
    {
      jobId: 'job-2',
      jobGrowId: 'grow-3',
      jobName: '직업2',
      jobGrowName: '眞 전직3',
      count: 100,
      averageFame: null
    }
  ],
  fameDistribution: [
    { from: 70000, to: 71000, count: 10 },
    { from: 121000, to: 122000, count: 66392 }
  ]
}

function render(getCharacterStats: () => Promise<CharacterStats>): Promise<void> {
  return act(async () =>
    root.render(
      <ClientHostContext value={createTestClientHost({ getCharacterStats })}>
        <TestQueryClient>
          <StatsScreen />
        </TestQueryClient>
      </ClientHostContext>
    )
  )
}

function boxOf(name: string): HTMLElement {
  return container.querySelector<HTMLElement>(`section[aria-label="${name}"]`)!
}

function rowsOf(name: string): string[][] {
  return [...boxOf(name).querySelectorAll('li:not([aria-hidden])')].map((row) =>
    [...row.children].map((cell) => cell.textContent ?? '')
  )
}

it('제목 상자에 캐릭터 수와 마지막 업데이트로부터 지난 시간을 보이고 한국 시간은 title로 둔다', async () => {
  await render(async () => stats)

  expect(container.querySelector('header')?.textContent).toBe(
    '캐릭터 통계캐릭터1,234,567마지막 업데이트 시간11시간 전'
  )
  expect(container.querySelector('header time')?.getAttribute('title')).toBe('11-06 00:30')
})

it('큰 수는 줄여 쓰고 상자 넷을 서버 인구, 명성 분포, 직업 분포, 직업별 평균 명성 순으로 그린다', async () => {
  await render(async () => stats)

  expect([...container.querySelectorAll('h2')].map((name) => name.textContent)).toEqual([
    '서버 인구',
    '명성 분포',
    '직업 분포',
    '직업별 평균 명성'
  ])
  expect(rowsOf('서버 인구')).toEqual([
    ['카인', '', '600', '0.0%'],
    ['바칼', '', '300', '0.0%']
  ])
  expect(rowsOf('직업 분포').map(([name, , value]) => [name, value])).toEqual([
    ['전직1', '400'],
    ['전직2', '200'],
    ['전직3', '100']
  ])
  expect(rowsOf('명성 분포')).toEqual([
    ['0~4만 0', '', '0'],
    ['4만~8만 10', '', '4만'],
    ['8만~12만 0', '', '8만'],
    ['12만~12.1만 0', '', '12만'],
    ['12.1만~12.2만 66,392', '', '']
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
  await render(async () => stats)

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

it('명성 분포 막대 사이 간격과 구분선을 지나도 툴팁을 닫지 않고 다음 막대의 구간과 인원으로 바꾼다', async () => {
  await render(async () => stats)

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

it('서버 인구와 직업 분포 행에 마우스를 올리면 전체 캐릭터 수 대비 비율을 띄우고 목록을 벗어나면 지운다', async () => {
  await render(async () => ({ ...stats, total: 1000 }))

  const serverRow = boxOf('서버 인구').querySelector('li')!
  const jobRow = boxOf('직업 분포').querySelector('li')!
  expect(tooltipText('서버 인구')).toBeNull()

  await moveMouse(document.body, serverRow)
  expect(tooltipText('서버 인구')).toBe('60.0%')

  await moveMouse(serverRow, jobRow)
  expect(tooltipText('서버 인구')).toBeNull()
  expect(tooltipText('직업 분포')).toBe('40.0%')
  expect(rowsOf('직업 분포').map((row) => row.at(-1))).toEqual(['40.0%', '20.0%', '10.0%'])
})

it('행 사이 간격을 지나도 비율 툴팁을 닫지 않고 다음 행의 비율로 바꾼다', async () => {
  await render(async () => ({ ...stats, total: 1000 }))

  const list = boxOf('서버 인구').querySelector('ul')!
  const [firstRow, secondRow] = [...list.querySelectorAll('li')]
  await moveMouse(document.body, firstRow!)
  await moveMouse(firstRow!, list)
  expect(tooltipText('서버 인구')).toBe('60.0%')

  await moveMouse(list, secondRow!)
  expect(tooltipText('서버 인구')).toBe('30.0%')

  await moveMouse(secondRow!, document.body)
  expect(tooltipText('서버 인구')).toBeNull()
})

it('직업별 평균 명성 행에는 마우스를 올려도 비율 툴팁이 없다', async () => {
  await render(async () => ({ ...stats, total: 1000 }))

  const row = boxOf('직업별 평균 명성').querySelector('li')!
  await moveMouse(document.body, row)

  expect(tooltipOf('직업별 평균 명성')).toBeNull()
  expect(boxOf('직업별 평균 명성').textContent).not.toContain('%')
})

it('평균 명성은 높은 순이고 명성이 있는 캐릭터가 없는 직업은 뺀다', async () => {
  await render(async () => stats)

  expect(rowsOf('직업별 평균 명성').map(([name, , value]) => [name, value])).toEqual([
    ['전직2', '90,000'],
    ['전직1', '80,000']
  ])
})

it('직업 분포와 직업별 평균 명성에서 眞이 붙지 않은 전직은 뺀다', async () => {
  await render(async () => ({
    ...stats,
    jobs: [
      ...stats.jobs,
      {
        jobId: 'job-2',
        jobGrowId: 'grow-4',
        jobName: '직업2',
        jobGrowName: '전직4',
        count: 500,
        averageFame: 100000
      }
    ]
  }))

  expect(rowsOf('직업 분포').map(([name]) => name)).toEqual(['전직1', '전직2', '전직3'])
  expect(rowsOf('직업별 평균 명성').map(([name]) => name)).toEqual(['전직2', '전직1'])
})

it('빈 통계는 상자마다 이름 한 줄만 둔다', async () => {
  await render(async () => ({
    ...stats,
    total: 0,
    servers: [],
    jobs: [],
    fameDistribution: []
  }))

  expect(container.querySelectorAll('li')).toHaveLength(0)
  expect(boxOf('서버 인구').textContent).toBe('서버 인구')
})

it('조회가 실패하면 오류를 알린다', async () => {
  await render(async () => {
    throw new Error('통계를 받지 못했습니다.')
  })

  expect(container.querySelector('[role="alert"]')?.textContent).toBe('통계를 받지 못했습니다.')
})
