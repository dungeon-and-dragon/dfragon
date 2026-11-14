// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { FameRanking, RankedCharacter } from '#core/ranking/ranking-stats'
import { ClientHostContext, type ClientHost } from '../../host/client-host'
import { createTestClientHost } from '../../testing/test-support/client-host'
import { TestQueryClient } from '../../testing/test-support/test-query-client'
import { TestRouter } from '../../testing/test-support/test-router'
import { RankingsScreen } from '../rankings/RankingsScreen'
import { FameRankingBox } from './FameRankingBox'

let container: HTMLDivElement
let root: Root

class FakeIntersectionObserver {
  observe(): void {}
  disconnect(): void {}
}

beforeEach(() => {
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

function rankedCharacter(rank: number): RankedCharacter {
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
    guildName: '합성 길드',
    role: null
  }
}

function rankingOf(count: number): FameRanking {
  return { characters: Array.from({ length: count }, (_, index) => rankedCharacter(index + 1)) }
}

function render(getFameRanking: ClientHost['getFameRanking']): Promise<void> {
  return act(async () =>
    root.render(
      <ClientHostContext value={createTestClientHost({ getFameRanking })}>
        <TestQueryClient>
          <TestRouter>
            <FameRankingBox />
          </TestRouter>
        </TestQueryClient>
      </ClientHostContext>
    )
  )
}

function bodyRows(): string[][] {
  return [...container.querySelectorAll('tbody tr:not([aria-hidden])')].map((row) =>
    [...row.querySelectorAll('td')].map((cell) => cell.textContent ?? '')
  )
}

it('직업 필터 없이 조회해 앞 3명을 순위, 캐릭터, 명성 열로 그린다', async () => {
  const getFameRanking = vi.fn<ClientHost['getFameRanking']>(async () => rankingOf(100))
  await render(getFameRanking)

  expect(getFameRanking).toHaveBeenCalledWith({})
  expect([...container.querySelectorAll('thead th')].map((cell) => cell.textContent)).toEqual([
    '#',
    '캐릭터',
    '명성'
  ])
  expect(bodyRows()).toEqual([
    ['1', '카인합성1합성 전직 합성 직업', '99,999'],
    ['2', '카인합성2합성 전직 합성 직업', '99,998'],
    ['3', '카인합성3합성 전직 합성 직업', '99,997']
  ])
  expect(container.querySelector('tbody a')?.getAttribute('href')).toBe('/c/cain/character-1')
})

it('3명보다 적으면 받은 만큼만 그린다', async () => {
  await render(async () => rankingOf(2))

  expect(bodyRows()).toHaveLength(2)
})

it('받는 중에는 빈 줄 3개를 그린다', async () => {
  await render(() => new Promise<FameRanking>(() => {}))

  expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  expect(container.querySelectorAll('tbody tr[aria-hidden]')).toHaveLength(3)
  expect(bodyRows()).toHaveLength(0)
})

it('조회에 실패하면 오류 문구 한 줄을 둔다', async () => {
  await render(async () => {
    throw new Error('랭킹을 받지 못했습니다.')
  })

  expect(container.querySelector('[role="alert"]')?.textContent).toBe('랭킹을 받지 못했습니다.')
  expect(container.querySelector('table')).toBeNull()
})

it('빈 랭킹은 박스에 이름 한 줄만 둔다', async () => {
  await render(async () => ({ characters: [] }))

  expect(container.querySelector('section[aria-label="명성 랭킹"]')?.textContent).toBe('명성 랭킹')
  expect(container.querySelector('table')).toBeNull()
})

it('랭킹 화면의 직업 전체 조회를 받아 두었으면 다시 조회하지 않는다', async () => {
  const getFameRanking = vi.fn<ClientHost['getFameRanking']>(async () => rankingOf(100))
  const host = createTestClientHost({ getFameRanking })
  function show(screen: React.JSX.Element): Promise<void> {
    return act(async () =>
      root.render(
        <ClientHostContext value={host}>
          <TestQueryClient>
            <TestRouter>{screen}</TestRouter>
          </TestQueryClient>
        </ClientHostContext>
      )
    )
  }

  await show(<RankingsScreen filter={{}} onFilterChange={() => {}} />)
  await show(<FameRankingBox />)

  expect(getFameRanking).toHaveBeenCalledTimes(1)
  expect(bodyRows()).toHaveLength(3)
})
