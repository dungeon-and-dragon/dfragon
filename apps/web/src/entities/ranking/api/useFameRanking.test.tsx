// @vitest-environment jsdom
import { delay, HttpResponse, http, type JsonBodyType } from 'msw'
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { FameRankingFilter } from '#entities/ranking/model/ranking-stats'
import type { LoadedResult } from '#shared/lib/useLoadedResult'
import { server } from '#testing/test-support/msw-server'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { fameRankingFixture } from './fame-ranking.fixture'
import { FAME_RANKING_URL } from './fame-ranking.handlers'
import { type FameRankingPage, useFameRanking } from './useFameRanking'

let container: HTMLDivElement
let root: Root
let result: LoadedResult<FameRankingPage>
let requests: URLSearchParams[]

function Harness({
  filter,
  page = 1,
  onResult
}: {
  filter: FameRankingFilter
  page?: number
  onResult: (value: LoadedResult<FameRankingPage>) => void
}): null {
  const value = useFameRanking(filter, page)
  useEffect(() => onResult(value))

  return null
}

function keep(value: LoadedResult<FameRankingPage>): void {
  result = value
}

beforeEach(() => {
  result = { status: 'loading' }
  requests = []
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

function respond(body: JsonBodyType): void {
  server.use(
    http.get(FAME_RANKING_URL, ({ request }) => {
      requests.push(new URL(request.url).searchParams)

      return HttpResponse.json(body)
    })
  )
}

async function settle(
  filter: FameRankingFilter,
  page?: number
): Promise<LoadedResult<FameRankingPage>> {
  await act(async () =>
    root.render(
      <TestQueryClient>
        <Harness filter={filter} page={page} onResult={keep} />
      </TestQueryClient>
    )
  )
  await vi.waitFor(() => expect(result.status).not.toBe('loading'))

  return result
}

function queries(): Record<string, string>[] {
  return requests.map((params) => Object.fromEntries(params))
}

it('응답을 그대로 읽고 정한 직업, 전직, 역할만 query로 보낸다', async () => {
  respond(fameRankingFixture.lastPage)

  const read = await settle({ jobId: 'job-1', jobGrowId: 'grow-1', role: 'dealer' })

  expect(read).toMatchObject({
    status: 'success',
    value: { page: 1, characters: fameRankingFixture.lastPage.characters, pageCount: 3 }
  })
  expect(queries()).toEqual([{ jobId: 'job-1', jobGrowId: 'grow-1', role: 'dealer' }])
})

it('필터가 없으면 query 없이 요청하고 빈 랭킹도 읽는다', async () => {
  respond(fameRankingFixture.empty)

  await expect(settle({})).resolves.toMatchObject({
    status: 'success',
    value: { characters: [], pageCount: 0 }
  })
  expect(queries()).toEqual([{}])
})

it('장비 세트, 서약 세트, 선택지를 query로 보낸다', async () => {
  respond(fameRankingFixture.lastPage)

  await settle({
    jobId: 'job-1',
    equipmentSetId: 'set-1',
    oathSetId: 16204,
    oathSetOption: '용투 : 용제 강림'
  })

  expect(queries()).toEqual([
    {
      jobId: 'job-1',
      equipmentSetId: 'set-1',
      oathSetId: '16204',
      oathSetOption: '용투 : 용제 강림'
    }
  ])
})

it('itemIds를 쉼표로 이어 보낸다', async () => {
  respond(fameRankingFixture.lastPage)

  await settle({ jobId: 'job-1', itemIds: ['weapon-1', 'ring-1'] })

  expect(queries()).toEqual([{ jobId: 'job-1', itemIds: 'weapon-1,ring-1' }])
})

it('개화 선택을 스킬 이름~종류 쌍을 쉼표로 이어 직업, 전직과 함께 보낸다', async () => {
  respond(fameRankingFixture.lastPage)

  await settle({
    jobId: 'job-1',
    jobGrowId: 'grow-1',
    evolutions: [
      { name: '발도', type: 1 },
      { name: '차지 버스트', type: 2 }
    ]
  })

  expect(queries()).toEqual([
    { jobId: 'job-1', jobGrowId: 'grow-1', evolutions: '발도~1,차지 버스트~2' }
  ])
})

it('검색 기준이 점수면 sort와 점수 범위를 보낸다', async () => {
  respond(fameRankingFixture.lastPage)

  await settle({ jobId: 'job-1', sort: 'buffScore', scoreFrom: 200000, scoreTo: 240000 })

  expect(queries()).toEqual([
    { jobId: 'job-1', sort: 'buffScore', scoreFrom: '200000', scoreTo: '240000' }
  ])
})

it('명성 범위를 query로 보내고, 범위 아래쪽만 있어도 보낸다', async () => {
  respond(fameRankingFixture.lastPage)

  await settle({ jobId: 'job-1', fameFrom: 136000, fameTo: 138000 })
  await act(async () => root.unmount())
  root = createRoot(container)
  await settle({ fameFrom: 0 })

  expect(queries()).toEqual([
    { jobId: 'job-1', fameFrom: '136000', fameTo: '138000' },
    { fameFrom: '0' }
  ])
})

it.each<[string, FameRankingFilter]>([
  ['직업 없는 전직', { jobGrowId: 'grow-1' }],
  ['서약 세트 없는 선택지', { oathSetOption: '용투 : 용제 강림' }],
  ['빈 itemId', { itemIds: [''] }],
  ['중복 itemId', { itemIds: ['a', 'a'] }],
  ['여섯 개 itemId', { itemIds: ['a', 'b', 'c', 'd', 'e', 'f'] }],
  ['쉼표가 든 itemId', { itemIds: ['a,b'] }],
  ['거꾸로 된 명성 범위', { fameFrom: 138000, fameTo: 136000 }],
  ['점수 기준의 명성 범위', { sort: 'equipmentScore', fameFrom: 136000 }],
  ['명성 기준의 점수 범위', { scoreFrom: 1300000 }],
  ['거꾸로 된 점수 범위', { sort: 'equipmentScore', scoreFrom: 1400000, scoreTo: 1300000 }],
  ['전직 없는 개화', { jobId: 'job-1', evolutions: [{ name: '발도', type: 1 }] }],
  [
    '같은 스킬의 개화 둘',
    {
      jobId: 'job-1',
      jobGrowId: 'grow-1',
      evolutions: [
        { name: '발도', type: 1 },
        { name: '발도', type: 2 }
      ]
    }
  ],
  [
    '여섯 스킬의 개화',
    {
      jobId: 'job-1',
      jobGrowId: 'grow-1',
      evolutions: ['가', '나', '다', '라', '마', '바'].map((name) => ({ name, type: 1 as const }))
    }
  ],
  [
    '구분자가 든 스킬 이름',
    { jobId: 'job-1', jobGrowId: 'grow-1', evolutions: [{ name: '가~나', type: 1 }] }
  ]
])('%s: 요청하지 않고 오류로 끝낸다', async (_name, filter) => {
  respond(fameRankingFixture.lastPage)

  await expect(settle(filter)).resolves.toMatchObject({ status: 'error' })
  expect(requests).toEqual([])
})

it('2쪽부터는 같은 필터에 page를 붙여 받고, 받는 동안 같은 필터의 앞 쪽을 그대로 둔다', async () => {
  let finish: () => void = () => {}
  server.use(
    http.get(FAME_RANKING_URL, async ({ request }) => {
      const params = new URL(request.url).searchParams
      requests.push(params)

      if (params.get('page') === '2') {
        await new Promise<void>((resolve) => {
          finish = resolve
        })

        return HttpResponse.json(fameRankingFixture.secondPage)
      }

      return HttpResponse.json(fameRankingFixture.firstPage)
    })
  )
  await settle({ oathSetId: 16204 })
  await settle({ oathSetId: 16204 }, 2)

  await vi.waitFor(() => expect(requests).toHaveLength(2))
  expect(result).toMatchObject({ status: 'success', value: { page: 1, pageCount: 3 } })
  await act(async () => finish())
  await vi.waitFor(() =>
    expect(result).toMatchObject({
      status: 'success',
      value: { page: 2, characters: fameRankingFixture.secondPage.characters, pageCount: 3 }
    })
  )
  expect(queries()).toEqual([{ oathSetId: '16204' }, { oathSetId: '16204', page: '2' }])
})

it('필터가 바뀌면 앞 필터의 쪽을 두지 않고 받는 중으로 둔다', async () => {
  server.use(
    http.get(FAME_RANKING_URL, async ({ request }) => {
      const params = new URL(request.url).searchParams
      requests.push(params)

      if (params.get('jobId') === 'job-2') {
        await delay('infinite')
      }

      return HttpResponse.json(fameRankingFixture.firstPage)
    })
  )
  await settle({ jobId: 'job-1' })
  await act(async () =>
    root.render(
      <TestQueryClient>
        <Harness filter={{ jobId: 'job-2' }} onResult={keep} />
      </TestQueryClient>
    )
  )

  await vi.waitFor(() => expect(requests).toHaveLength(2))
  expect(result).toEqual({ status: 'loading' })
})

const [character] = fameRankingFixture.lastPage.characters

it.each<[string, JsonBodyType]>([
  ['모르는 서버', { characters: [{ ...character, serverId: 'unknown' }], pageCount: 1 }],
  ['pageCount가 없는 응답', { characters: [character] }],
  ['pageCount가 음수인 응답', { characters: [character], pageCount: -1 }],
  [
    '서약 세트 id가 문자열인 행',
    {
      characters: [{ ...character, oathSet: { id: '16204', name: '서약', option: null } }],
      pageCount: 1
    }
  ]
])('%s: 오류로 끝낸다', async (_name, body) => {
  respond(body)

  await expect(settle({})).resolves.toMatchObject({ status: 'error' })
})
