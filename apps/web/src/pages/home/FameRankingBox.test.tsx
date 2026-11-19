// @vitest-environment jsdom
import { HttpResponse, http } from 'msw'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { FameRanking, RankedCharacter } from '#entities/ranking'
import { fameRankingFixture } from '#entities/ranking/api/fame-ranking.fixture'
import { FAME_RANKING_URL, fameRankingFailure } from '#entities/ranking/api/fame-ranking.handlers'
import { server } from '#testing/test-support/msw-server'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { TestRouter } from '#testing/test-support/test-router'
import { FameRankingBox } from './FameRankingBox'

let container: HTMLDivElement
let root: Root
let requests: URLSearchParams[]

beforeEach(() => {
  requests = []
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

function rankedCharacter(order: number): RankedCharacter {
  return {
    serverId: 'cain',
    characterId: `character-${order}`,
    characterName: `합성${order}`,
    adventureName: `모험단${order}`,
    level: 115,
    jobId: 'job-1',
    jobGrowId: 'grow-1',
    jobName: '합성 직업',
    jobGrowName: '眞 합성 전직',
    fame: 100000 - order,
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

it('직업 필터 없이 조회해 앞 3명을 받은 순서의 순위, 캐릭터, 명성 열로 그린다', async () => {
  const characters = [7, 3, 9, 1].map((order) => rankedCharacter(order))

  respondRanking({ characters, nextCursor: null })
  await render()
  await settled()

  expect(requests.map((params) => Object.fromEntries(params))).toEqual([{}])
  expect([...container.querySelectorAll('thead th')].map((cell) => cell.textContent)).toEqual([
    '#',
    '캐릭터',
    '명성'
  ])
  expect(bodyRows()).toEqual([
    ['1', '카인합성7합성 전직', '99,993'],
    ['2', '카인합성3합성 전직', '99,997'],
    ['3', '카인합성9합성 전직', '99,991']
  ])
  expect(container.querySelector('tbody a')?.getAttribute('href')).toBe('/c/cain/character-7')
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
