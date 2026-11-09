// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { SHARED_GROW_JOB_NAMES } from '#core/character/job-display'
import { formatJobName } from '#core/character/job-format'
import type { FameRanking, FameRankingFilter, RankedCharacter } from '#core/ranking/ranking-stats'
import { ClientHostContext, type ClientHost } from '../../host/client-host'
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
    role: null,
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
  expect(first).toEqual(['1', '카인합성1합성 전직', '99,999', '모험단1', '합성 길드'])
  expect(fourth).toEqual(['4', '카인합성4합성 직업', '99,996', '모험단4', '-'])
  expect(bodyRows()[0].querySelector('a')?.getAttribute('href')).toBe('/c/cain/character-1')
})

function characterLines(row: Element): (string | null)[] {
  const line = row.querySelector('a[href^="/c/"]')?.parentElement
  const nameLine = line?.textContent ?? null
  const levelLine = line?.nextElementSibling?.textContent ?? null

  return [nameLine, levelLine]
}

it('만렙은 서버, 이름, 직업명을 한 줄로 두고, 만렙이 아니면 그 아래 줄에 레벨만 둔다', async () => {
  await render(async () => ({
    characters: [rankedCharacter(1), rankedCharacter(2, { level: 110 })]
  }))

  const [maxLevel, belowMax] = bodyRows()
  expect(characterLines(maxLevel!)).toEqual(['카인합성1합성 전직', null])
  expect(characterLines(belowMax!)).toEqual(['카인합성2합성 전직', 'Lv.110'])
})

it('남성 크루세이더는 역할을 알면 역할을 붙이고 겹치는 전직은 성별을 붙인다', async () => {
  const maleCrusader = { jobName: '프리스트(남)', jobGrowName: '眞 크루세이더' }
  await render(async () => ({
    characters: [
      rankedCharacter(1, { ...maleCrusader, role: 'dealer' }),
      rankedCharacter(2, { ...maleCrusader, role: 'buffer' }),
      rankedCharacter(3, { ...maleCrusader, role: null }),
      rankedCharacter(4, { jobName: '프리스트(여)', jobGrowName: '眞 크루세이더', role: 'buffer' }),
      rankedCharacter(5, { jobName: '프리스트(남)', jobGrowName: '眞 인파이터', role: 'dealer' }),
      rankedCharacter(6, { jobName: '격투가(여)', jobGrowName: '眞 넨마스터' })
    ]
  }))

  expect(bodyRows().map((row) => characterLines(row)[0])).toEqual([
    '카인합성1크루세이더(딜러)',
    '카인합성2크루세이더(버퍼)',
    '카인합성3크루세이더 (남)',
    '카인합성4크루세이더 (여)',
    '카인합성5인파이터 (남)',
    '카인합성6넨마스터 (여)'
  ])
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

it('제국기사 칩을 고르면 목록 이름이 바뀌고, 브레이커 전직 칩으로 전직까지 넘긴다', async () => {
  const jobId = '8d4d2001cdb357e41633c234eb7501b5'
  const onFilterChange = vi.fn()
  await render(async () => rankingOf(1), {}, onFilterChange)

  await act(async () => chip('제국기사').click())
  expect(onFilterChange).toHaveBeenLastCalledWith({ jobId })

  await render(async () => rankingOf(1), { jobId }, onFilterChange)
  expect(container.querySelector('section[aria-label="제국기사 명성 랭킹"]')).not.toBeNull()
  await act(async () => chip('브레이커').click())
  expect(onFilterChange).toHaveBeenLastCalledWith({
    jobId,
    jobGrowId: '37495b941da3b1661bc900e68ef3b2c6'
  })
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

const MALE_PRIEST = 'f6a4ad30555b99b499c07835f87ce522'
const CRUSADER = '37495b941da3b1661bc900e68ef3b2c6'

function chipLabels(): string[] {
  const growRow = [...container.querySelectorAll('h2')].find(
    (heading) => heading.textContent === '전직'
  )

  return [...(growRow?.parentElement?.querySelectorAll('button') ?? [])].map(
    (button) => button.textContent ?? ''
  )
}

it('프리스트(남)는 크루세이더 칩 대신 딜러, 버퍼 칩을 두고 고른 역할을 필터로 넘긴다', async () => {
  const onFilterChange = vi.fn()
  await render(async () => rankingOf(1), { jobId: MALE_PRIEST }, onFilterChange)

  expect(chipLabels()).toEqual([
    '전직 전체',
    '크루세이더(딜러)',
    '크루세이더(버퍼)',
    '인파이터',
    '퇴마사',
    '어벤저'
  ])
  await act(async () => chip('크루세이더(버퍼)').click())
  expect(onFilterChange).toHaveBeenLastCalledWith({
    jobId: MALE_PRIEST,
    jobGrowId: CRUSADER,
    role: 'buffer'
  })
  await act(async () => chip('인파이터').click())
  expect(onFilterChange).toHaveBeenLastCalledWith({
    jobId: MALE_PRIEST,
    jobGrowId: '618326026de1a1f1cfba5dbd0b8396e7'
  })
})

it('크루세이더(딜러)를 고르면 역할로 조회하고 그 칩만 눌린 채 목록 이름에 전직과 역할을 쓴다', async () => {
  const getFameRanking = vi.fn<ClientHost['getFameRanking']>(async () => rankingOf(1))
  await render(getFameRanking, { jobId: MALE_PRIEST, jobGrowId: CRUSADER, role: 'dealer' })

  expect(getFameRanking).toHaveBeenCalledWith({
    jobId: MALE_PRIEST,
    jobGrowId: CRUSADER,
    role: 'dealer'
  })
  expect(
    container.querySelector('section[aria-label="프리스트(남) 크루세이더(딜러) 명성 랭킹"]')
  ).not.toBeNull()
  expect(chip('크루세이더(딜러)').hasAttribute('data-pressed')).toBe(true)
  expect(chip('크루세이더(버퍼)').hasAttribute('data-pressed')).toBe(false)
  expect(chip('전직 전체').hasAttribute('data-pressed')).toBe(false)
})

it('겹치는 전직 목록은 랭킹의 두 직업 이상에 걸친 전직과 같다', () => {
  const jobsByGrow = new Map<string, Set<string>>()
  for (const job of RANKING_JOBS) {
    for (const grow of job.grows) {
      const name = formatJobName(grow.name)
      const jobs = jobsByGrow.get(name) ?? new Set<string>()
      jobs.add(job.jobId)
      jobsByGrow.set(name, jobs)
    }
  }
  const shared = [...jobsByGrow].filter(([, jobs]) => jobs.size > 1).map(([name]) => name)
  expect([...SHARED_GROW_JOB_NAMES].sort()).toEqual(shared.sort())
})
