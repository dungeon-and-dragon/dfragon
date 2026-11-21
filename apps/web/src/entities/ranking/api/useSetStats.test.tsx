// @vitest-environment jsdom
import { HttpResponse, http, type JsonBodyType } from 'msw'
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { SetStats } from '#entities/ranking/model/set-stats'
import type { SetStatsFilter } from '#entities/ranking/model/ranking-stats'
import type { LoadedResult } from '#shared/lib/useLoadedResult'
import { server } from '#testing/test-support/msw-server'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { SET_STATS_URL } from './set-stats.handlers'
import { useSetStats } from './useSetStats'

let container: HTMLDivElement
let root: Root
let result: LoadedResult<SetStats>
let queries: Record<string, string>[]

function Harness({ filter }: { filter: SetStatsFilter }): null {
  const value = useSetStats(filter)
  useEffect(() => {
    result = value
  })

  return null
}

beforeEach(() => {
  result = { status: 'loading' }
  queries = []
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
    http.get(SET_STATS_URL, ({ request }) => {
      queries.push(Object.fromEntries(new URL(request.url).searchParams))

      return HttpResponse.json(body)
    })
  )
}

async function settle(filter: SetStatsFilter): Promise<LoadedResult<SetStats>> {
  await act(async () =>
    root.render(
      <TestQueryClient>
        <Harness filter={filter} />
      </TestQueryClient>
    )
  )
  await vi.waitFor(() => expect(result.status).not.toBe('loading'))

  return result
}

// #1798의 실제 응답 모양이다. 세 목록 각각의 count 합이 sampleSize이고, 서약 세트 하나의 선택지 count 합이 그 세트 count다.
const setStats: SetStats = {
  computedAt: '2026-11-18T11:00:27.845Z',
  sampleSize: 4,
  equipmentSets: [
    { setId: 'set-fairy', name: '소울 페어리 세트', count: 3 },
    { setId: null, name: null, count: 1 }
  ],
  oathSets: [
    {
      setId: 16204,
      name: '야망의 용투 서약',
      count: 2,
      options: [
        { name: '용투 : 세계를 태우는 불꽃', count: 1 },
        { name: '용투 : 합성 선택지', count: 1 }
      ]
    },
    { setId: null, name: null, count: 2, options: [{ name: null, count: 2 }] }
  ],
  combos: [
    { equipmentSetId: 'set-fairy', oathSetId: 16204, count: 2 },
    { equipmentSetId: 'set-fairy', oathSetId: null, count: 1 },
    { equipmentSetId: null, oathSetId: null, count: 1 }
  ]
}

it('고른 직업, 전직, 역할을 query로 보낸다', async () => {
  respond(setStats)

  await expect(settle({ jobId: 'job-1', jobGrowId: 'grow-1', role: 'buffer' })).resolves.toEqual({
    status: 'success',
    value: setStats
  })
  expect(queries).toEqual([{ jobId: 'job-1', jobGrowId: 'grow-1', role: 'buffer', sample: 'all' }])
})

it('직업 없는 전직은 요청하지 않고 검색 조건 오류로 끝낸다', async () => {
  respond(setStats)

  await expect(settle({ jobGrowId: 'grow-1' })).resolves.toEqual({
    status: 'error',
    message: '검색 조건을 확인해 주세요.'
  })
  expect(queries).toEqual([])
})

const [fairy, noSet] = setStats.equipmentSets
const [dragon, noOath] = setStats.oathSets

it.each<[string, SetStats]>([
  [
    '장비 세트 count 합이 표본 수와 다른 응답',
    { ...setStats, equipmentSets: [fairy, { ...noSet, count: 2 }] }
  ],
  [
    '선택지 count 합이 서약 세트 count와 다른 응답',
    { ...setStats, oathSets: [{ ...dragon, options: dragon.options.slice(1) }, noOath] }
  ],
  ['조합 count 합이 표본 수와 다른 응답', { ...setStats, combos: setStats.combos.slice(1) }]
])('%s: 응답 확인 오류로 끝낸다', async (_name, body) => {
  respond(body)

  await expect(settle({})).resolves.toEqual({
    status: 'error',
    message: '검색 응답을 확인하지 못했습니다. 다시 시도해 주세요.'
  })
})
