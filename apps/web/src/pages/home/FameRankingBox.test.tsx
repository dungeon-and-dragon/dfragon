// @vitest-environment jsdom
import { HttpResponse, http } from 'msw'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { FameRanking, RankedCharacter } from '#core/ranking'
import { fameRankingFixture } from '#entities/ranking/api/fame-ranking.fixture'
import { FAME_RANKING_URL, fameRankingFailure } from '#entities/ranking/api/fame-ranking.handlers'
import { ClientHostContext } from '#host/client-host'
import { createTestClientHost } from '#testing/test-support/client-host'
import { server } from '#testing/test-support/msw-server'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { TestRouter } from '#testing/test-support/test-router'
import { RankingsScreen } from '#pages/rankings'
import { FameRankingBox } from './FameRankingBox'

let container: HTMLDivElement
let root: Root
let requests: URLSearchParams[]

class FakeIntersectionObserver {
  observe(): void {}
  disconnect(): void {}
}

beforeEach(() => {
  requests = []
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
    role: null,
    equipmentSet: null,
    oathSet: null
  }
}

function rankingOf(count: number): FameRanking {
  return {
    characters: Array.from({ length: count }, (_, index) => rankedCharacter(index + 1)),
    nextCursor: null
  }
}

function respond(response: () => Response | Promise<Response>): void {
  server.use(
    http.get(FAME_RANKING_URL, ({ request }) => {
      requests.push(new URL(request.url).searchParams)

      return response()
    })
  )
}

function respondRanking(ranking: FameRanking): void {
  respond(() => HttpResponse.json(ranking))
}

function render(): Promise<void> {
  return act(async () =>
    root.render(
      <TestQueryClient>
        <TestRouter>
          <FameRankingBox />
        </TestRouter>
      </TestQueryClient>
    )
  )
}

function settled(): Promise<void> {
  return vi.waitFor(() => expect(container.querySelector('[aria-busy="true"]')).toBeNull())
}

function bodyRows(): string[][] {
  return [...container.querySelectorAll('tbody tr:not([aria-hidden])')].map((row) =>
    [...row.querySelectorAll('td')].map((cell) => cell.textContent ?? '')
  )
}

it('직업 필터 없이 조회해 앞 3명을 순위, 캐릭터, 명성 열로 그린다', async () => {
  respondRanking(rankingOf(100))
  await render()
  await settled()

  expect(requests.map((params) => Object.fromEntries(params))).toEqual([{}])
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
  respondRanking(rankingOf(2))
  await render()
  await settled()

  expect(bodyRows()).toHaveLength(2)
})

it('받는 중에는 빈 줄 3개를 그린다', async () => {
  respond(() => new Promise<Response>(() => {}))
  await render()

  expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  expect(container.querySelectorAll('tbody tr[aria-hidden]')).toHaveLength(3)
  expect(bodyRows()).toHaveLength(0)
})

it('조회에 실패하면 오류 문구 한 줄을 둔다', async () => {
  respond(() => fameRankingFailure(fameRankingFixture.failureMessage))
  await render()
  await settled()

  expect(container.querySelector('[role="alert"]')?.textContent).toBe(
    fameRankingFixture.failureMessage
  )
  expect(container.querySelector('table')).toBeNull()
})

it('빈 랭킹은 박스에 이름 한 줄만 둔다', async () => {
  respondRanking({ characters: [], nextCursor: null })
  await render()
  await settled()

  expect(container.querySelector('section[aria-label="명성 랭킹"]')?.textContent).toBe('명성 랭킹')
  expect(container.querySelector('table')).toBeNull()
})

it('랭킹 화면의 직업 전체 조회를 받아 두었으면 다시 조회하지 않는다', async () => {
  respondRanking(rankingOf(100))
  const host = createTestClientHost()
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
  await vi.waitFor(() =>
    expect(container.querySelector('tbody tr:not([aria-hidden])')).not.toBeNull()
  )
  await show(<FameRankingBox />)

  expect(requests).toHaveLength(1)
  expect(bodyRows()).toHaveLength(3)
})
