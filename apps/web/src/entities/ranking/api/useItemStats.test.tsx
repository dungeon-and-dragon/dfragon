// @vitest-environment jsdom
import { HttpResponse, http, type JsonBodyType } from 'msw'
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ItemStats } from '#entities/ranking/model/item-stats'
import type { SetStatsFilter } from '#entities/ranking/model/ranking-stats'
import type { LoadedResult } from '#shared/lib/useLoadedResult'
import { server } from '#testing/test-support/msw-server'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { ITEM_STATS_URL } from './item-stats.handlers'
import { useItemStats } from './useItemStats'

let container: HTMLDivElement
let root: Root
let result: LoadedResult<ItemStats>
let queries: Record<string, string>[]

function Harness({ filter }: { filter: SetStatsFilter }): null {
  const value = useItemStats(filter)
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
    http.get(ITEM_STATS_URL, ({ request }) => {
      queries.push(Object.fromEntries(new URL(request.url).searchParams))

      return HttpResponse.json(body)
    })
  )
}

async function settle(filter: SetStatsFilter): Promise<LoadedResult<ItemStats>> {
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

// #1802의 실제 응답 모양이다. 유일 장비가 없는 캐릭터는 부위의 items에 없어 그 부위 count 합이 sampleSize보다 작다.
const itemStats: ItemStats = {
  computedAt: '2026-11-18T15:38:47.900Z',
  sampleSize: 5,
  slots: [
    {
      slotId: 'WEAPON',
      items: [
        { itemId: 'item-weapon-a', name: '합성 무기', typeDetail: '도', count: 2 },
        { itemId: 'item-weapon-b', name: '합성 다른 무기', typeDetail: '낫', count: 2 }
      ]
    },
    {
      slotId: 'RING',
      items: [{ itemId: 'item-ring-a', name: '합성 반지', typeDetail: null, count: 1 }]
    }
  ]
}

it('고른 직업, 전직, 역할을 query로 보내고 부위 count 합이 표본 수보다 작은 응답을 읽는다', async () => {
  respond(itemStats)

  await expect(settle({ jobId: 'job-1', jobGrowId: 'grow-1', role: 'dealer' })).resolves.toEqual({
    status: 'success',
    value: itemStats
  })
  expect(queries).toEqual([{ jobId: 'job-1', jobGrowId: 'grow-1', role: 'dealer' }])
})

it('직업 없는 전직은 요청하지 않고 검색 조건 오류로 끝낸다', async () => {
  respond(itemStats)

  await expect(settle({ jobGrowId: 'grow-1' })).resolves.toEqual({
    status: 'error',
    message: '검색 조건을 확인해 주세요.'
  })
  expect(queries).toEqual([])
})

it('한 부위의 count 합이 표본 수보다 크면 응답 확인 오류로 끝낸다', async () => {
  respond({ ...itemStats, sampleSize: 3 })

  await expect(settle({})).resolves.toEqual({
    status: 'error',
    message: '검색 응답을 확인하지 못했습니다. 다시 시도해 주세요.'
  })
})
