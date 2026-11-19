// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { OathCatalog } from '#core/catalog'
import type { SetStats, SetStatsFilter } from '#core/ranking'
import { ClientHostContext, type ClientHost } from '#host/client-host'
import { createTestClientHost } from '#testing/test-support/client-host'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { TestRouter } from '#testing/test-support/test-router'
import { SetStatsScreen } from './SetStatsScreen'

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
const UNLISTED = 'unlisted-equipment-set'
const DRAGON = 16204

// 합성 통계다. 세트 id와 이름, 선택지 이름은 게임 데이터 그대로다.
const stats: SetStats = {
  computedAt: '2026-11-18T11:00:27.845Z',
  sampleSize: 8,
  equipmentSets: [
    { setId: FAIRY, name: '로열 페어리 세트', count: 2 },
    { setId: null, name: null, count: 2 },
    { setId: GOLDEN, name: '영원히 이어지는 황금향 세트', count: 3 },
    { setId: UNLISTED, name: '나아가려는 자의 마음 세트', count: 1 }
  ],
  oathSets: [
    {
      setId: DRAGON,
      name: '야망의 용투 서약',
      count: 4,
      options: [
        { name: '용투 : 싸워야만 하는 운명', count: 1 },
        { name: '용투 : 세계를 태우는 불꽃', count: 3 }
      ]
    },
    { setId: null, name: null, count: 4, options: [{ name: null, count: 4 }] }
  ],
  combos: [
    { equipmentSetId: GOLDEN, oathSetId: DRAGON, count: 2 },
    { equipmentSetId: FAIRY, oathSetId: null, count: 2 },
    { equipmentSetId: null, oathSetId: null, count: 3 },
    { equipmentSetId: UNLISTED, oathSetId: DRAGON, count: 1 }
  ]
}

const catalog: OathCatalog = {
  version: 'synthetic',
  sets: [
    {
      setId: DRAGON,
      name: '야망의 용투 서약',
      icon: null,
      options: ['세계를 태우는 불꽃', '용제 강림', '싸워야만 하는 운명'].map((name) => ({
        name: `용투 : ${name}`,
        icon: '',
        effects: { rare: null, unique: null, legendary: null, epic: null, primitive: null }
      }))
    }
  ],
  items: []
}

const JOB_FILTER: SetStatsFilter = { jobId: 'job-1', jobGrowId: 'grow-1' }

function render(
  overrides: Partial<Pick<ClientHost, 'getSetStats' | 'getOathCatalog'>>,
  filter: SetStatsFilter = JOB_FILTER
): Promise<void> {
  const host = createTestClientHost({ getOathCatalog: async () => catalog, ...overrides })

  return act(async () =>
    root.render(
      <ClientHostContext value={host}>
        <TestQueryClient>
          <TestRouter>
            <SetStatsScreen filter={filter} onFilterChange={vi.fn()} />
          </TestRouter>
        </TestQueryClient>
      </ClientHostContext>
    )
  )
}

function boxOf(name: string): HTMLElement {
  return container.querySelector<HTMLElement>(`section[aria-label="${name}"]`)!
}

function rowsOf(name: string): [string, string][] {
  return [...boxOf(name).querySelectorAll('[data-chart-item]')].map((row) => [
    row.querySelector('[data-chart-name]')?.textContent ?? '',
    row.querySelector('[data-chart-count], .num')?.textContent ?? ''
  ])
}

function rankingSearchOf(link: Element | null | undefined): Record<string, string> | null {
  const href = link?.getAttribute('href')
  if (href == null) {
    return null
  }

  const url = new URL(href, 'https://site.test')
  expect(url.pathname).toBe('/rankings')

  return Object.fromEntries(url.searchParams)
}

function rowLink(name: string, rowName: string): Element | null | undefined {
  const row = [...boxOf(name).querySelectorAll('[data-chart-item]')].find(
    (item) => item.querySelector('[data-chart-name]')?.textContent === rowName
  )

  return row?.querySelector(':scope > div a')
}

it('장비 세트는 줄임말로 많은 순에 세트 없음을 맨 아래 두고, 표본 전체 대비 비율의 합이 100%다', async () => {
  const getSetStats = vi.fn(async () => stats)
  await render({ getSetStats })

  expect(getSetStats).toHaveBeenCalledWith(JOB_FILTER)
  expect(rowsOf('장비 세트')).toEqual([
    ['황금향', '37.5%'],
    ['페어리', '25.0%'],
    ['나아가려는 자의 마음 세트', '12.5%'],
    ['세트 없음', '25.0%']
  ])
  const total = rowsOf('장비 세트').reduce((sum, [, share]) => sum + Number.parseFloat(share), 0)
  expect(total).toBe(100)
  expect(container.querySelector('header .stat-value')?.textContent).toBe('8')
})

it('서약 세트 아래 카탈로그 순서로 선택지를 펼치고, 아무도 고르지 않은 선택지는 0%이며 세트 안 비율의 합이 100%다', async () => {
  await render({ getSetStats: async () => stats })

  expect(rowsOf('서약 세트')).toEqual([
    ['용투', '50.0%'],
    ['용투 : 첫 번째', '75.0%'],
    ['용투 : 두 번째', '0.0%'],
    ['용투 : 세 번째', '25.0%'],
    ['세트 없음', '50.0%']
  ])
})

it('서약 세트의 선택지는 세트마다 접고 다시 펼친다', async () => {
  await render({ getSetStats: async () => stats })
  const toggle = boxOf('서약 세트').querySelector<HTMLButtonElement>('button[aria-expanded]')!

  expect(toggle.getAttribute('aria-expanded')).toBe('true')
  await act(async () => toggle.click())
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  expect(rowsOf('서약 세트').map(([name]) => name)).toEqual(['용투', '세트 없음'])
  await act(async () => toggle.click())
  expect(rowsOf('서약 세트')).toHaveLength(5)
})

it('카탈로그를 받지 못하면 받은 선택지를 원래 이름으로 보인다', async () => {
  await render({ getSetStats: async () => stats, getOathCatalog: async () => null })

  expect(rowsOf('서약 세트').map(([name]) => name)).toEqual([
    '용투',
    '용투 : 싸워야만 하는 운명',
    '용투 : 세계를 태우는 불꽃',
    '세트 없음'
  ])
})

it('세트와 선택지 막대는 고른 직업, 전직과 그 세트로 거른 랭킹으로 잇고 세트 없음은 잇지 않는다', async () => {
  await render({ getSetStats: async () => stats })

  expect(rankingSearchOf(rowLink('장비 세트', '페어리'))).toEqual({
    ...JOB_FILTER,
    equipmentSetId: FAIRY
  })
  expect(rowLink('장비 세트', '세트 없음')).toBeNull()
  expect(rankingSearchOf(rowLink('서약 세트', '용투'))).toEqual({
    ...JOB_FILTER,
    oathSetId: String(DRAGON)
  })
  expect(rankingSearchOf(rowLink('서약 세트', '용투 : 두 번째'))).toEqual({
    ...JOB_FILTER,
    oathSetId: String(DRAGON),
    oathSetOption: '용투 : 용제 강림'
  })
  expect(rowLink('서약 세트', '세트 없음')).toBeNull()
})

it('조합은 두 세트를 함께 랭킹에 붙이고, 한쪽이라도 세트가 없으면 잇지 않는다', async () => {
  await render({ getSetStats: async () => stats })

  expect(rowsOf('장비와 서약 조합')).toEqual([
    ['황금향 + 용투', '25.0%'],
    ['페어리 + 세트 없음', '25.0%'],
    ['나아가려는 자의 마음 세트 + 용투', '12.5%'],
    ['세트 없음', '37.5%']
  ])
  expect(rankingSearchOf(rowLink('장비와 서약 조합', '황금향 + 용투'))).toEqual({
    ...JOB_FILTER,
    equipmentSetId: GOLDEN,
    oathSetId: String(DRAGON)
  })
  expect(rowLink('장비와 서약 조합', '페어리 + 세트 없음')).toBeNull()
})

it('저장분이 없으면 집계 시각 없이 상자마다 세트 통계가 없다고 알린다', async () => {
  await render({
    getSetStats: async () => ({
      computedAt: null,
      sampleSize: 0,
      equipmentSets: [],
      oathSets: [],
      combos: []
    })
  })

  expect(container.querySelector('header')?.textContent).toBe('세트 통계')
  expect([...container.querySelectorAll('section p')].map((p) => p.textContent)).toEqual([
    '세트 통계가 없습니다.',
    '세트 통계가 없습니다.',
    '세트 통계가 없습니다.'
  ])
})

it('받는 중에는 상자 제목과 skeleton을 보인다', async () => {
  await render({})

  expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  expect([...container.querySelectorAll('section h2')].map((h2) => h2.textContent)).toEqual([
    '장비 세트',
    '서약 세트',
    '장비와 서약 조합'
  ])
})

it('받지 못하면 세트 통계를 받지 못했다고 알린다', async () => {
  await render({
    getSetStats: async () => {
      throw new Error('network')
    }
  })
  await vi.waitFor(() =>
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      '세트 통계를 받지 못했습니다.'
    )
  )
})
