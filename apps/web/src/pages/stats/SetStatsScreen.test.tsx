// @vitest-environment jsdom
import { type HttpHandler, HttpResponse, http } from 'msw'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ItemStats } from '#entities/ranking'
import type { OathCatalog } from '#entities/catalog'
import type { SetStats, SetStatsFilter } from '#entities/ranking'
import { oathCatalogHandlers } from '#entities/catalog/api/oath-catalog.handlers'
import { ITEM_STATS_URL, itemStatsHandlers } from '#entities/ranking/api/item-stats.handlers'
import { SET_STATS_URL, setStatsHandlers } from '#entities/ranking/api/set-stats.handlers'
import { server } from '#testing/test-support/msw-server'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { TestRouter } from '#testing/test-support/test-router'
import { SetStatsScreen } from './SetStatsScreen'

let container: HTMLDivElement
let root: Root
let setStatsQueries: Record<string, string>[]

beforeEach(() => {
  setStatsQueries = []
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

function setStatsOf(body: SetStats): HttpHandler {
  return http.get(SET_STATS_URL, ({ request }) => {
    setStatsQueries.push(Object.fromEntries(new URL(request.url).searchParams))

    return HttpResponse.json(body)
  })
}

function itemStatsOf(body: ItemStats): HttpHandler {
  return http.get(ITEM_STATS_URL, () => HttpResponse.json(body))
}

type Responses = Readonly<{
  setStats?: HttpHandler
  oathCatalog?: HttpHandler
  itemStats?: HttpHandler
}>

function mount(
  {
    setStats = setStatsHandlers.loading,
    oathCatalog = oathCatalogHandlers.catalog(catalog),
    itemStats = itemStatsHandlers.loading
  }: Responses,
  filter: SetStatsFilter = JOB_FILTER
): Promise<void> {
  server.use(setStats, oathCatalog, itemStats)

  return act(async () =>
    root.render(
      <TestQueryClient>
        <TestRouter>
          <SetStatsScreen filter={filter} onFilterChange={vi.fn()} />
        </TestRouter>
      </TestQueryClient>
    )
  )
}

async function render(responses: Responses, filter?: SetStatsFilter): Promise<void> {
  await mount(responses, filter)
  await vi.waitFor(() => expect(container.textContent).not.toContain('세트 통계를 받는 중입니다.'))
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

it('직업을 고른 통계 화면의 필터 상자에는 초기화 버튼이 없다', async () => {
  await render({ setStats: setStatsOf(stats) })

  expect(container.querySelector('[role="group"]')).not.toBeNull()
  expect(
    [...container.querySelectorAll('button')].some((button) => button.textContent === '초기화')
  ).toBe(false)
})

it('장비 세트는 줄임말로 많은 순에 세트 없음을 맨 아래 두고, 표본 전체 대비 비율의 합이 100%다', async () => {
  await render({ setStats: setStatsOf(stats) })

  expect(setStatsQueries).toEqual([JOB_FILTER])
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
  await render({ setStats: setStatsOf(stats) })

  expect(rowsOf('서약 세트')).toEqual([
    ['용투', '50.0%'],
    ['용투 : 첫 번째', '75.0%'],
    ['용투 : 두 번째', '0.0%'],
    ['용투 : 세 번째', '25.0%'],
    ['세트 없음', '50.0%']
  ])
})

it('서약 세트의 선택지는 세트마다 접고 다시 펼친다', async () => {
  await render({ setStats: setStatsOf(stats) })
  const toggle = boxOf('서약 세트').querySelector<HTMLButtonElement>('button[aria-expanded]')!

  expect(toggle.getAttribute('aria-expanded')).toBe('true')
  await act(async () => toggle.click())
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  expect(rowsOf('서약 세트').map(([name]) => name)).toEqual(['용투', '세트 없음'])
  await act(async () => toggle.click())
  expect(rowsOf('서약 세트')).toHaveLength(5)
})

it('카탈로그를 받지 못하면 받은 선택지를 원래 이름으로 보인다', async () => {
  await render({ setStats: setStatsOf(stats), oathCatalog: oathCatalogHandlers.notUploaded })

  expect(rowsOf('서약 세트').map(([name]) => name)).toEqual([
    '용투',
    '용투 : 싸워야만 하는 운명',
    '용투 : 세계를 태우는 불꽃',
    '세트 없음'
  ])
})

it('세트와 선택지 막대는 고른 직업, 전직과 그 세트로 거른 랭킹으로 잇고 세트 없음은 잇지 않는다', async () => {
  await render({ setStats: setStatsOf(stats) })

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
  await render({ setStats: setStatsOf(stats) })

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
  await render({ setStats: setStatsHandlers.empty })

  expect(container.querySelector('header')?.textContent).toBe('세트 통계')
  expect([...container.querySelectorAll('section p')].map((p) => p.textContent)).toEqual([
    '세트 통계가 없습니다.',
    '세트 통계가 없습니다.',
    '세트 통계가 없습니다.'
  ])
})

it('받는 중에는 상자 제목과 skeleton을 보인다', async () => {
  await mount({})

  expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  expect([...container.querySelectorAll('section h2')].map((h2) => h2.textContent)).toEqual([
    '장비 세트',
    '서약 세트',
    '장비와 서약 조합',
    '무기',
    '유일 장비'
  ])
})

it('받지 못하면 세트 통계를 받지 못했다고 알린다', async () => {
  await render({ setStats: http.get(SET_STATS_URL, () => HttpResponse.error()) })
  await vi.waitFor(() =>
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      '세트 통계를 받지 못했습니다.'
    )
  )
})

// 합성 아이템 통계다. 유일 장비 이름은 게임 데이터 그대로다.
function itemStatsWith(weaponCount: number): ItemStats {
  const weapons = Array.from({ length: weaponCount }, (_, index) => ({
    itemId: `weapon-${index + 1}`,
    name: `무기${index + 1}`,
    typeDetail: null,
    count: weaponCount - index
  }))

  return {
    computedAt: '2026-11-18T15:38:47.900Z',
    sampleSize: 100,
    slots: [
      { slotId: 'WEAPON', items: weapons },
      {
        slotId: 'RING',
        items: [{ itemId: 'ring-1', name: '광휘를 머금은 눈동자', typeDetail: null, count: 72 }]
      },
      {
        slotId: 'EARRING',
        items: [
          { itemId: 'earring-1', name: '영롱한 날씨의 큐브', typeDetail: null, count: 40 },
          { itemId: 'earring-2', name: '합성 귀걸이', typeDetail: null, count: 10 }
        ]
      }
    ]
  }
}

it('전체 직업 무기는 많은 순 10개와 나머지를 묶은 그 밖 막대이고, 무기 막대는 그 itemId로 거른 랭킹으로 잇는다', async () => {
  await render({ setStats: setStatsOf(stats), itemStats: itemStatsOf(itemStatsWith(12)) }, {})

  const weapons = await vi.waitFor(() => {
    const rows = rowsOf('무기')
    expect(rows).toHaveLength(11)

    return rows
  })
  expect(weapons[0]).toEqual(['무기1', '12.0%'])
  expect(weapons.at(-1)).toEqual(['그 밖', '3.0%'])
  expect(rankingSearchOf(rowLink('무기', '무기1'))).toEqual({ itemIds: 'weapon-1' })
  expect(rowLink('무기', '그 밖')).toBeNull()
})

it('전직을 고르면 그 전직의 무기를 그 밖으로 묶지 않고 많은 순으로 모두 보인다', async () => {
  await render({ setStats: setStatsOf(stats), itemStats: itemStatsOf(itemStatsWith(12)) })

  await vi.waitFor(() => expect(rowsOf('무기')).toHaveLength(12))
  expect(rankingSearchOf(rowLink('무기', '무기2'))).toEqual({ ...JOB_FILTER, itemIds: 'weapon-2' })
})

it('유일 장비는 부위마다 착용 비율 한 줄이고, 한 종뿐인 부위만 그 itemId로 거른 랭킹으로 잇는다', async () => {
  await render({ setStats: setStatsOf(stats), itemStats: itemStatsOf(itemStatsWith(2)) })

  await vi.waitFor(() =>
    expect(rowsOf('유일 장비')).toEqual([
      ['반지 유일 장비 착용', '72.0%'],
      ['귀걸이 유일 장비 착용', '50.0%']
    ])
  )
  expect(rankingSearchOf(rowLink('유일 장비', '반지 유일 장비 착용'))).toEqual({
    ...JOB_FILTER,
    itemIds: 'ring-1'
  })
  expect(rowLink('유일 장비', '귀걸이 유일 장비 착용')).toBeNull()
})

it('아이템 통계 저장분이 없으면 무기, 유일 장비 상자에 아이템 통계가 없다고 알린다', async () => {
  await render({ setStats: setStatsOf(stats), itemStats: itemStatsHandlers.empty })

  await vi.waitFor(() =>
    expect(boxOf('무기').querySelector('p.state')?.textContent).toBe('아이템 통계가 없습니다.')
  )
  expect(boxOf('유일 장비').querySelector('p.state')?.textContent).toBe('아이템 통계가 없습니다.')
})
