// @vitest-environment jsdom
import { HttpResponse, http } from 'msw'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ItemCount, ItemStats, SetStatsFilter } from '#entities/ranking'
import { ITEM_STATS_URL, itemStatsHandlers } from '#entities/ranking/api/item-stats.handlers'
import { server } from '#testing/test-support/msw-server'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { TestRouter } from '#testing/test-support/test-router'
import { WeaponStatsScreen } from './WeaponStatsScreen'
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

const JOB_FILTER: SetStatsFilter = { jobId: 'job-1', jobGrowId: 'grow-1' }

function weapon(itemId: string, name: string, typeDetail: string | null, count: number): ItemCount {
  return { itemId, name, typeDetail, count }
}

// 합성 아이템 통계다. 무기 이름과 종류는 게임 데이터 그대로이고 itemId는 합성 값이다.
function statsOf(weapons: readonly ItemCount[], sampleSize: number): ItemStats {
  return {
    computedAt: '2026-11-18T15:38:47.900Z',
    sampleSize,
    slots: [{ slotId: 'WEAPON', items: [...weapons] }]
  }
}

async function render(stats: ItemStats): Promise<void> {
  server.use(http.get(ITEM_STATS_URL, () => HttpResponse.json(stats)))
  await act(async () =>
    root.render(
      <TestQueryClient>
        <TestRouter>
          <WeaponStatsScreen filter={JOB_FILTER} onFilterChange={vi.fn()} />
        </TestRouter>
      </TestQueryClient>
    )
  )
  await vi.waitFor(() =>
    expect(container.textContent).not.toContain('아이템 통계를 받는 중입니다.')
  )
}

function boxNames(): string[] {
  return [...container.querySelectorAll('section h2')].map((h2) => h2.textContent ?? '')
}

it('무기를 종류마다 상자로 나눠 낀 캐릭터가 많은 종류부터 두고, 상자 제목에 표본 대비 비율, 막대에 그 종류 안 비율을 보인다', async () => {
  await render(
    statsOf(
      [
        weapon('sword-1', '무형검 - 생사경', '소검', 3),
        weapon('blade-1', '역작 금인필살도', '도', 4),
        weapon('blade-2', '첫 섬광', '도', 1),
        weapon('sword-2', '태초의 별 - 소검', '소검', 1),
        weapon('unknown-1', '합성 무기', null, 1)
      ],
      20
    )
  )

  expect(boxNames()).toEqual(['도 25.0%', '소검 20.0%', '종류 없음 5.0%'])
  expect(rowsOf(container, '도 25.0%')).toEqual([
    ['역작 금인필살도', '80.0%'],
    ['첫 섬광', '20.0%']
  ])
  expect(rankingSearchOf(rowLink(container, '소검 20.0%', '무형검 - 생사경'))).toEqual({
    ...JOB_FILTER,
    itemIds: 'sword-1'
  })
})

it('종류마다 많은 순 10개만 막대로 두고, 나머지와 0.0%로 보일 무기는 몇 종인지 적은 그 밖 막대로 묶어 잇지 않는다', async () => {
  const many = Array.from({ length: 12 }, (_, index) =>
    weapon(`blade-${index + 1}`, `도${index + 1}`, '도', 1000 - index)
  )
  const rare = weapon('blade-rare', '드문 도', '도', 1)
  await render(statsOf([...many, rare], 23_870))

  const rows = rowsOf(container, '도 50.0%')
  expect(rows).toHaveLength(11)
  expect(rows[0]![0]).toBe('도1')
  expect(rows.at(-1)).toEqual(['그 밖 3종', '16.6%'])
  expect(rowLink(container, '도 50.0%', '그 밖 3종')).toBeNull()

  await act(async () => root.unmount())
  root = createRoot(container)
  await render(statsOf([weapon('blade-1', '도1', '도', 9999), rare], 10_000))

  expect(rowsOf(container, '도 100.0%')).toEqual([
    ['도1', '100.0%'],
    ['그 밖 1종', '0.0%']
  ])
})

it('검은 질병의, 억압 - 접두사가 붙은 무기는 접두사 없는 무기와 한 막대로 센다', async () => {
  await render(
    statsOf(
      [
        weapon('staff', '오케아누스 프라이모디어', '스탭', 2),
        weapon('staff-plague', '검은 질병의 오케아누스 프라이모디어', '스탭', 2)
      ],
      4
    )
  )

  expect(rowsOf(container, '스탭 100.0%')).toEqual([['오케아누스 프라이모디어', '100.0%']])
  expect(rankingSearchOf(rowLink(container, '스탭 100.0%', '오케아누스 프라이모디어'))).toEqual({
    ...JOB_FILTER,
    itemIds: 'staff'
  })
})

it('받는 중에는 실제 상자처럼 두 칸씩 놓인 skeleton을 보인다', async () => {
  server.use(itemStatsHandlers.loading)
  await act(async () =>
    root.render(
      <TestQueryClient>
        <TestRouter>
          <WeaponStatsScreen filter={JOB_FILTER} onFilterChange={vi.fn()} />
        </TestRouter>
      </TestQueryClient>
    )
  )

  const rows = [...container.querySelectorAll('[aria-hidden="true"] .section-cols')]
  expect(rows.map((row) => row.querySelectorAll('section .skeleton').length)).toEqual([2, 2])
})
