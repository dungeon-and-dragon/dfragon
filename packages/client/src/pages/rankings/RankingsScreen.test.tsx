// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type {
  FameRanking,
  FameRankingFilter,
  RankedCharacter
} from '@dfragon/client-core/shared/ranking/ranking-stats'
import { ClientHostContext, type ClientHost } from '../../hooks/useClientHost'
import { createTestClientHost } from '../../testing/test-support/client-host'
import { TestQueryClient } from '../../testing/test-support/test-query-client'
import { TestRouter } from '../../testing/test-support/test-router'
import { RankingsScreen } from './RankingsScreen'
import { RANKING_JOBS } from './ranking-jobs'

let container: HTMLDivElement
let root: Root
let observed: { callback: IntersectionObserverCallback; target: Element }[]

class FakeIntersectionObserver {
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe(target: Element): void {
    observed.push({ callback: this.callback, target })
  }
  disconnect(): void {
    observed = observed.filter((entry) => entry.callback !== this.callback)
  }
}

beforeEach(() => {
  observed = []
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

function rankedCharacter(rank: number, overrides: Partial<RankedCharacter> = {}): RankedCharacter {
  return {
    rank,
    serverId: 'cain',
    characterId: `character-${rank}`,
    characterName: `합성${rank}`,
    adventureName: `모험단${rank}`,
    level: 115,
    jobId: 'job-1',
    jobGrowId: 'grow-1',
    jobName: '합성 직업',
    jobGrowName: '眞 합성 전직',
    fame: 100000 - rank,
    guildId: null,
    guildName: null,
    ...overrides
  }
}

function rankingOf(count: number): FameRanking {
  return { characters: Array.from({ length: count }, (_, index) => rankedCharacter(index + 1)) }
}

function render(
  getFameRanking: ClientHost['getFameRanking'],
  filter: FameRankingFilter = {},
  onFilterChange: (filter: FameRankingFilter) => void = () => {}
): Promise<void> {
  return act(async () =>
    root.render(
      <ClientHostContext value={createTestClientHost({ getFameRanking })}>
        <TestQueryClient>
          <TestRouter>
            <RankingsScreen filter={filter} onFilterChange={onFilterChange} />
          </TestRouter>
        </TestQueryClient>
      </ClientHostContext>
    )
  )
}

function bodyRows(): HTMLTableRowElement[] {
  return [...container.querySelectorAll<HTMLTableRowElement>('tbody tr:not([aria-hidden])')]
}

function reachEnd(): Promise<void> {
  return act(async () => {
    for (const { callback, target } of observed) {
      callback([{ isIntersecting: true, target } as IntersectionObserverEntry], {} as never)
    }
  })
}

function chip(label: string): HTMLButtonElement {
  return [...container.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) => button.textContent === label
  )!
}

it('받은 100명 가운데 처음 20명을 그리고 끝에 닿을 때마다 20명씩 더 그린다', async () => {
  await render(async () => rankingOf(100))

  expect(bodyRows()).toHaveLength(20)
  expect(container.querySelectorAll('tr[aria-hidden]')).toHaveLength(1)
  await reachEnd()
  expect(bodyRows()).toHaveLength(40)
  await reachEnd()
  await reachEnd()
  await reachEnd()
  expect(bodyRows()).toHaveLength(100)
  expect(container.querySelectorAll('tr[aria-hidden]')).toHaveLength(0)
})

it('열은 순위, 캐릭터, 명성, 모험단, 길드이고 값이 없는 길드는 -로 그린다', async () => {
  await render(async () => ({
    characters: [
      rankedCharacter(1, { guildName: '합성 길드' }),
      rankedCharacter(4, { level: null, jobGrowName: null, jobName: '합성 직업' })
    ]
  }))

  expect([...container.querySelectorAll('thead th')].map((cell) => cell.textContent)).toEqual([
    '#',
    '캐릭터',
    '명성',
    '모험단',
    '길드'
  ])
  const [first, fourth] = bodyRows().map((row) =>
    [...row.querySelectorAll('td')].map((cell) => cell.textContent)
  )
  expect(first).toEqual(['1', '카인합성1Lv.115 | 합성 전직', '99,999', '모험단1', '합성 길드'])
  expect(fourth).toEqual(['4', '카인합성4합성 직업', '99,996', '모험단4', '-'])
  expect(bodyRows()[0].querySelector('a')?.getAttribute('href')).toBe('/c/cain/character-1')
})

it('빈 랭킹은 목록 상자에 이름 한 줄만 둔다', async () => {
  await render(async () => ({ characters: [] }))

  expect(container.querySelector('section[aria-label="명성 랭킹"]')?.textContent).toBe('명성 랭킹')
  expect(container.querySelector('table')).toBeNull()
})

it('고른 직업으로 목록 이름을 바꾸고, 앞의 眞을 뺀 전직 이름 칩으로 필터 변경을 알린다', async () => {
  const [job] = RANKING_JOBS
  const onFilterChange = vi.fn()
  await render(async () => rankingOf(1), { jobId: job.jobId }, onFilterChange)

  expect(container.querySelector(`section[aria-label="${job.name} 명성 랭킹"]`)).not.toBeNull()
  expect(chip(job.name).hasAttribute('data-pressed')).toBe(true)
  expect(chip('직업 전체').hasAttribute('data-pressed')).toBe(false)
  await act(async () => chip('웨펀마스터').click())
  expect(onFilterChange).toHaveBeenLastCalledWith({
    jobId: job.jobId,
    jobGrowId: job.grows[0].jobGrowId
  })
  await act(async () => chip('직업 전체').click())
  expect(onFilterChange).toHaveBeenLastCalledWith({})
})

it('필터에 맞춰 직업, 전직을 넘겨 조회하고 실패하면 오류를 알린다', async () => {
  const [job] = RANKING_JOBS
  const getFameRanking = vi.fn<ClientHost['getFameRanking']>(async () => {
    throw new Error('랭킹을 받지 못했습니다.')
  })
  await render(getFameRanking, { jobId: job.jobId, jobGrowId: job.grows[0].jobGrowId })

  expect(getFameRanking).toHaveBeenCalledWith({
    jobId: job.jobId,
    jobGrowId: job.grows[0].jobGrowId
  })
  expect(container.querySelector('[role="alert"]')?.textContent).toBe('랭킹을 받지 못했습니다.')
})
