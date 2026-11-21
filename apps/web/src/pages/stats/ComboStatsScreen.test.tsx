// @vitest-environment jsdom
import { HttpResponse, http } from 'msw'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { SetStats, SetStatsFilter } from '#entities/ranking'
import { SET_STATS_URL, setStatsHandlers } from '#entities/ranking/api/set-stats.handlers'
import { server } from '#testing/test-support/msw-server'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { TestRouter } from '#testing/test-support/test-router'
import { ComboStatsScreen } from './ComboStatsScreen'
import { rankingSearchOf, rowLink, rowsOf } from '#testing/test-support/stats-screen'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
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

const GOLDEN = '7f788a703a87d783079b41d0fe6448c9'
const FAIRY = '4ee7bd5912cda6e2a24c1f36d5202b46'
const DRAGON = 16204
const PURIFY = 16205
const BOX = '장비와 서약 조합'
const JOB_FILTER: SetStatsFilter = { jobId: 'job-1', jobGrowId: 'grow-1' }

// 합성 통계다. 세트 id와 이름은 게임 데이터 그대로다.
const stats: SetStats = {
  computedAt: '2026-11-18T11:00:27.845Z',
  sampleSize: 10,
  equipmentSets: [
    { setId: FAIRY, name: '소울 페어리 세트', count: 2 },
    { setId: null, name: null, count: 2 },
    { setId: GOLDEN, name: '영원히 이어지는 황금향 세트', count: 6 }
  ],
  oathSets: [
    { setId: DRAGON, name: '야망의 용투 서약', count: 4, options: [{ name: null, count: 4 }] },
    { setId: PURIFY, name: '완전무결한 정화 서약', count: 3, options: [{ name: null, count: 3 }] },
    { setId: null, name: null, count: 3, options: [{ name: null, count: 3 }] }
  ],
  combos: [
    { equipmentSetId: GOLDEN, oathSetId: DRAGON, count: 3 },
    { equipmentSetId: GOLDEN, oathSetId: null, count: 1 },
    { equipmentSetId: GOLDEN, oathSetId: PURIFY, count: 2 },
    { equipmentSetId: FAIRY, oathSetId: DRAGON, count: 1 },
    { equipmentSetId: FAIRY, oathSetId: PURIFY, count: 1 },
    { equipmentSetId: null, oathSetId: null, count: 2 }
  ]
}

async function render(body: SetStats, filter: SetStatsFilter = JOB_FILTER): Promise<void> {
  server.use(http.get(SET_STATS_URL, () => HttpResponse.json(body)))
  await act(async () =>
    root.render(
      <TestQueryClient>
        <TestRouter>
          <ComboStatsScreen filter={filter} onFilterChange={vi.fn()} />
        </TestRouter>
      </TestQueryClient>
    )
  )
  await vi.waitFor(() => expect(container.textContent).not.toContain('세트 통계를 받는 중입니다.'))
}

it('장비 세트를 많은 순으로 두고, 세트마다 그 장비 세트를 쓴 캐릭터 안에서 서약 세트 비율을 펼친다', async () => {
  await render(stats)

  expect(rowsOf(container, BOX)).toEqual([
    ['황금향', '60.0%'],
    ['용투장', '50.0%'],
    ['칠흑', '33.3%'],
    ['세트 없음', '16.7%'],
    ['페어리', '20.0%'],
    ['용투장', '50.0%'],
    ['칠흑', '50.0%'],
    ['세트 없음', '20.0%']
  ])
})

it('서약 세트 막대는 장비와 서약 세트로 함께 거른 랭킹으로 잇고, 서약 세트가 없는 막대는 잇지 않는다', async () => {
  await render(stats)

  const links = [...container.querySelectorAll('[data-chart-item] a')].map(rankingSearchOf)
  expect(links).toContainEqual({ ...JOB_FILTER, equipmentSetId: GOLDEN, oathSetId: String(DRAGON) })
  expect(links).toContainEqual({ ...JOB_FILTER, equipmentSetId: FAIRY, oathSetId: String(PURIFY) })
  expect(rankingSearchOf(rowLink(container, BOX, '황금향'))).toEqual({
    ...JOB_FILTER,
    equipmentSetId: GOLDEN
  })
  expect(links.filter((search) => search?.oathSetId === undefined)).toHaveLength(2)
})

it('저장분이 없으면 세트 통계가 없다고 알린다', async () => {
  server.use(setStatsHandlers.empty)
  await act(async () =>
    root.render(
      <TestQueryClient>
        <TestRouter>
          <ComboStatsScreen filter={{}} onFilterChange={vi.fn()} />
        </TestRouter>
      </TestQueryClient>
    )
  )

  await vi.waitFor(() =>
    expect(container.querySelector('p.state')?.textContent).toBe('세트 통계가 없습니다.')
  )
  expect(container.querySelector(`section[aria-label="${BOX}"]`)).toBeNull()
})
