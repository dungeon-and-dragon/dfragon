// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CharacterStats } from '@dfragon/client-core/shared/ranking/ranking-stats'
import { ClientHostContext } from '../../hooks/useClientHost'
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
    { from: 70000, to: 80000, count: 10 },
    { from: 80000, to: 90000, count: 66392 }
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
  return [...boxOf(name).querySelectorAll('li')].map((row) =>
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
    ['카인', '', '600'],
    ['바칼', '', '300']
  ])
  expect(rowsOf('직업 분포').map(([name, , value]) => [name, value])).toEqual([
    ['전직1', '400'],
    ['전직2', '200'],
    ['전직3', '100']
  ])
  expect(rowsOf('명성 분포')).toEqual([
    ['10', '', '7만'],
    ['6.6만', '', '8만']
  ])
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
