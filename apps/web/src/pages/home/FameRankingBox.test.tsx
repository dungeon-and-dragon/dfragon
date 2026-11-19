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
    score: null,
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

function scoreToneOf(element: Element): string | undefined {
  return [...element.classList].find(
    (name) => name.startsWith('text-score-') || name === 'text-fg-subtle'
  )
}

function bodyRows(): string[][] {
  return [...container.querySelectorAll('tbody tr:not([aria-hidden])')].map((row) =>
    [...row.querySelectorAll('td')].map((cell) => cell.textContent ?? '')
  )
}

it('직업 필터 없이 조회해 앞 3명을 받은 순서의 순위, 캐릭터, 명성 열로 그리고 점수는 열을 늘리지 않고 명성 아래 줄에 둔다', async () => {
  const characters = [
    { ...rankedCharacter(7), score: { calculator: 'equipment' as const, value: 1_388_832 } },
    { ...rankedCharacter(3), score: { calculator: 'buff' as const, value: 4_120_000 } },
    rankedCharacter(9),
    rankedCharacter(1)
  ]

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
    ['1', '카인합성7합성 전직', '99,9931,388,832'],
    ['2', '카인합성3합성 전직', '99,9974,120,000'],
    ['3', '카인합성9합성 전직', '99,991-']
  ])
  const scoreLines = [...container.querySelectorAll('tbody tr td:last-child span span:last-child')]
  expect(scoreLines.map((line) => [line.textContent, scoreToneOf(line)])).toEqual([
    ['1,388,832', 'text-score-dealer'],
    ['4,120,000', 'text-score-buffer'],
    ['-', 'text-fg-subtle']
  ])
  expect(container.querySelector('tbody a')?.getAttribute('href')).toBe('/c/cain/character-7')
})

it('3명보다 적으면 받은 만큼만 그린다', async () => {
  respondRanking(rankingOf(2))
  await render()
  await settled()

  expect(bodyRows()).toHaveLength(2)
})

it('받는 중에는 명성과 점수 줄 자리까지 둔 빈 줄 3개를 그린다', async () => {
  respond(() => new Promise<Response>(() => {}))
  await render()

  expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  const skeletonRows = [...container.querySelectorAll('tbody tr[aria-hidden]')]
  expect(skeletonRows).toHaveLength(3)
  expect(
    skeletonRows.map((row) => row.querySelectorAll('td:last-child .skeleton-text').length)
  ).toEqual([2, 2, 2])
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
