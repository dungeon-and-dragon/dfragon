// @vitest-environment jsdom
import { type HttpHandler, HttpResponse, http } from 'msw'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ItemStats } from '#entities/ranking'
import type { OathCatalog } from '#entities/catalog'
import { RANKING_JOBS } from '#entities/character'
import type { SetStats, SetStatsFilter } from '#entities/ranking'
import { storyItemDetail } from '#widgets/item-tooltip/api/item-detail.fixture'
import { ITEM_DETAIL_URL } from '#widgets/item-tooltip/api/item-detail.handlers'
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
let itemStatsQueries: Record<string, string>[]

beforeEach(() => {
  setStatsQueries = []
  itemStatsQueries = []
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
const DRAGON_ARENA = 'b92ca7784123b5fea9cea40144925194'
const UNLISTED = 'unlisted-equipment-set'
const DRAGON = 16204
const LUCK = 16206

// 합성 통계다. 세트 id와 이름, 선택지 이름은 게임 데이터 그대로다.
const stats: SetStats = {
  computedAt: '2026-11-18T11:00:27.845Z',
  sampleSize: 8,
  equipmentSets: [
    { setId: FAIRY, name: '로열 페어리 세트', count: 2 },
    { setId: null, name: null, count: 2 },
    { setId: GOLDEN, name: '영원히 이어지는 황금향 세트', count: 2 },
    { setId: DRAGON_ARENA, name: '용투장의 난 세트', count: 1 },
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

function catalogSet(
  setId: number,
  name: string,
  prefix: string,
  options: readonly string[]
): OathCatalog['sets'][number] {
  return {
    setId,
    name,
    icon: null,
    options: options.map((option) => ({
      name: `${prefix} : ${option}`,
      icon: '',
      effects: { rare: null, unique: null, legendary: null, epic: null, primitive: null }
    }))
  }
}

const catalog: OathCatalog = {
  version: 'synthetic',
  sets: [
    catalogSet(DRAGON, '야망의 용투 서약', '용투', [
      '용제 강림',
      '세계를 태우는 불꽃',
      '싸워야만 하는 운명'
    ]),
    catalogSet(LUCK, '운명의 행운 서약', '행운', ['찬란한 운명', '일궈낸 운명', '혼돈의 운명'])
  ],
  items: []
}

const JOB_FILTER: SetStatsFilter = { jobId: 'job-1', jobGrowId: 'grow-1' }
const [otherJob] = RANKING_JOBS

function setStatsOf(body: SetStats): HttpHandler {
  return http.get(SET_STATS_URL, ({ request }) => {
    setStatsQueries.push(Object.fromEntries(new URL(request.url).searchParams))

    return HttpResponse.json(body)
  })
}

function itemStatsOf(body: ItemStats): HttpHandler {
  return http.get(ITEM_STATS_URL, ({ request }) => {
    itemStatsQueries.push(Object.fromEntries(new URL(request.url).searchParams))

    return HttpResponse.json(body)
  })
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
  filter: SetStatsFilter = JOB_FILTER,
  onFilterChange: (filter: SetStatsFilter) => void = vi.fn()
): Promise<void> {
  server.use(setStats, oathCatalog, itemStats)

  return act(async () =>
    root.render(
      <TestQueryClient>
        <TestRouter>
          <SetStatsScreen filter={filter} onFilterChange={onFilterChange} />
        </TestRouter>
      </TestQueryClient>
    )
  )
}

async function render(
  responses: Responses,
  filter?: SetStatsFilter,
  onFilterChange?: (filter: SetStatsFilter) => void
): Promise<void> {
  await mount(responses, filter, onFilterChange)
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

function columnsOf(): HTMLElement[] {
  return [...boxOf('장비 세트').querySelectorAll<HTMLElement>('[data-chart-item]')]
}

function accessibleNameOf(column: HTMLElement): string {
  const name = column.firstElementChild?.getAttribute('aria-label')
  if (name == null) {
    return ''
  }

  return name
}

function columnLabels(): string[] {
  return columnsOf().map((column) => accessibleNameOf(column).split(', ')[0] ?? '')
}

function columnOf(setName: string): HTMLElement {
  return columnsOf().find((column) => accessibleNameOf(column).startsWith(`${setName} `))!
}

async function hoverColumn(setName: string): Promise<string[]> {
  const column = columnOf(setName)
  await act(async () => {
    column.dispatchEvent(
      new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body })
    )
  })
  const tooltip = boxOf('장비 세트').querySelector('[aria-hidden="true"]')!

  return [...tooltip.querySelectorAll('span')]
    .filter((span) => span.children.length === 0)
    .map((span) => span.textContent ?? '')
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

function chipOf(label: string): HTMLButtonElement {
  return [...container.querySelectorAll('button')].find((button) => button.textContent === label)!
}

it('표본을 고르지 않으면 전체를 골라 보이고, 고른 표본은 세트와 아이템 통계에 함께 보낸다', async () => {
  await render({ setStats: setStatsOf(stats), itemStats: itemStatsOf(itemStatsWith(1)) })
  await vi.waitFor(() => expect(itemStatsQueries).toHaveLength(1))

  expect(chipOf('전체').getAttribute('aria-pressed')).toBe('true')
  expect(itemStatsQueries).toEqual([{ ...JOB_FILTER, sample: 'all' }])

  await render(
    { setStats: setStatsOf(stats), itemStats: itemStatsOf(itemStatsWith(1)) },
    { ...JOB_FILTER, sample: 'fame' }
  )
  await vi.waitFor(() => expect(itemStatsQueries).toHaveLength(2))

  expect(chipOf('명성 117,014 이상').getAttribute('aria-pressed')).toBe('true')
  expect(setStatsQueries.at(-1)).toEqual({ ...JOB_FILTER, sample: 'fame' })
  expect(itemStatsQueries.at(-1)).toEqual({ ...JOB_FILTER, sample: 'fame' })
})

it('표본 칩은 직업, 전직을 두고 표본만 바꾸며, 직업을 바꿔도 고른 표본을 그대로 둔다', async () => {
  const onFilterChange = vi.fn()
  await render({ setStats: setStatsOf(stats) }, { ...JOB_FILTER, sample: 'fame' }, onFilterChange)

  await act(async () => chipOf('상위 500명').click())
  await act(async () => chipOf('전체').click())
  await act(async () => chipOf(otherJob.name).click())

  expect(onFilterChange.mock.calls).toEqual([
    [{ ...JOB_FILTER, sample: 'top' }],
    [{ ...JOB_FILTER, sample: undefined }],
    [expect.objectContaining({ jobId: otherJob.jobId, sample: 'fame' })]
  ])
})

it('장비 세트는 서약 계열 12세트를 아무도 끼지 않았어도 모두 많은 순으로 보이고, 세트 없음과 서약이 없는 세트는 뺀다', async () => {
  await render({ setStats: setStatsOf(stats) })

  expect(setStatsQueries).toEqual([{ ...JOB_FILTER, sample: 'all' }])
  const labels = columnLabels()
  expect(labels.slice(0, 3)).toEqual(['황금향 25.0%', '페어리 25.0%', '용투장 12.5%'])
  expect(labels.slice(3).toSorted()).toEqual(
    ['칠흑', '여우', '무리', '세렌디', '그림자', '발키리', '한계', '자연', '마력']
      .map((name) => `${name} 0.0%`)
      .toSorted()
  )
})

it('장비 세트 막대에 마우스를 올리면 같은 계열 서약의 왼쪽, 가운데, 오른쪽 선택지 비율을 보이고, 아무도 고르지 않은 선택지는 0%다', async () => {
  await render({ setStats: setStatsOf(stats) })

  expect(await hoverColumn('용투장')).toEqual([
    '용투장',
    '12.5%',
    '왼쪽',
    '용제 강림',
    '0.0%',
    '가운데',
    '세계를 태우는 불꽃',
    '75.0%',
    '오른쪽',
    '싸워야만 하는 운명',
    '25.0%'
  ])
})

it('장비 세트 막대는 스크린 리더에 같은 계열 서약 선택지 비율까지 읽힌다', async () => {
  await render({ setStats: setStatsOf(stats) })

  expect(accessibleNameOf(columnOf('용투장'))).toBe(
    '용투장 12.5%, 왼쪽 용제 강림 0.0%, 가운데 세계를 태우는 불꽃 75.0%, 오른쪽 싸워야만 하는 운명 25.0%'
  )
})

it('세렌디 세트는 행운 서약의 선택지를 보인다', async () => {
  await render({ setStats: setStatsOf(stats) })

  expect(await hoverColumn('세렌디')).toEqual([
    '세렌디',
    '0.0%',
    '왼쪽',
    '찬란한 운명',
    '0.0%',
    '가운데',
    '일궈낸 운명',
    '0.0%',
    '오른쪽',
    '혼돈의 운명',
    '0.0%'
  ])
})

it('서약 카탈로그를 받지 못하면 장비 세트 툴팁에 세트 이름과 비율만 보인다', async () => {
  await render({ setStats: setStatsOf(stats), oathCatalog: oathCatalogHandlers.notUploaded })

  expect(await hoverColumn('용투장')).toEqual(['용투장', '12.5%'])
})

it('장비 세트 막대는 고른 직업, 전직과 그 세트로 거른 랭킹으로 잇는다', async () => {
  await render({ setStats: setStatsOf(stats) })

  expect(rankingSearchOf(columnOf('페어리').querySelector('a'))).toEqual({
    ...JOB_FILTER,
    equipmentSetId: FAIRY
  })
})

it('조합은 두 세트가 모두 있고 장비가 서약 계열 세트인 조합만 보이며, 두 세트를 함께 랭킹에 붙인다', async () => {
  await render({ setStats: setStatsOf(stats) })

  expect(rowsOf('장비와 서약 조합')).toEqual([['황금향 + 용투장', '25.0%']])
  expect(rankingSearchOf(rowLink('장비와 서약 조합', '황금향 + 용투장'))).toEqual({
    ...JOB_FILTER,
    equipmentSetId: GOLDEN,
    oathSetId: String(DRAGON)
  })
})

it('저장분이 없으면 집계 시각 없이 상자마다 세트 통계가 없다고 알린다', async () => {
  await render({ setStats: setStatsHandlers.empty })

  expect(container.querySelector('header')).toBeNull()
  expect([...container.querySelectorAll('section p')].map((p) => p.textContent)).toEqual([
    '세트 통계가 없습니다.',
    '세트 통계가 없습니다.'
  ])
})

it('받는 중에는 상자 제목과 skeleton을 보인다', async () => {
  await mount({})

  expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  expect([...container.querySelectorAll('section h2')].map((h2) => h2.textContent)).toEqual([
    '장비 세트',
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

// 합성 아이템 통계다. 유일 장비의 itemId와 이름은 게임 데이터 그대로다.
const RING = 'aa5273499f19ddba846919dbb6857d82'
const EARRING = '14449881bc371352c250502e7b201506'

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
        items: [{ itemId: RING, name: '광휘를 머금은 눈동자', typeDetail: null, count: 72 }]
      },
      {
        slotId: 'EARRING',
        items: [{ itemId: EARRING, name: '영롱한 날씨의 큐브', typeDetail: null, count: 50 }]
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

it('0.0%로 보일 만큼 적게 낀 무기는 막대를 두지 않는다', async () => {
  const itemStats = { ...itemStatsWith(5), sampleSize: 3000 }
  await render({ setStats: setStatsOf(stats), itemStats: itemStatsOf(itemStats) })

  await vi.waitFor(() =>
    expect(rowsOf('무기')).toEqual([
      ['무기1', '0.2%'],
      ['무기2', '0.1%'],
      ['무기3', '0.1%'],
      ['무기4', '0.1%']
    ])
  )
})

it('무기 막대에 아이콘을 보이고, 이름에 마우스를 올리면 그 무기의 상세를 툴팁으로 보인다', async () => {
  const requestedItemIds: string[] = []
  server.use(
    http.get(ITEM_DETAIL_URL, ({ params }) => {
      requestedItemIds.push(String(params.itemId))

      return HttpResponse.json(storyItemDetail(String(params.itemId)))
    })
  )
  await render({ setStats: setStatsOf(stats), itemStats: itemStatsOf(itemStatsWith(2)) })
  const name = await vi.waitFor(() => {
    const row = [...boxOf('무기').querySelectorAll('[data-chart-name]')].find(
      (cell) => cell.textContent === '무기1'
    )
    expect(row?.querySelector('img')).not.toBeNull()

    return row!.firstElementChild as HTMLElement
  })

  // Base UI Tooltip은 trigger의 mouseenter를 직접 듣는다.
  await act(async () => {
    name.dispatchEvent(new MouseEvent('mouseenter'))
  })

  await vi.waitFor(() => {
    expect(document.body.textContent).toContain('레벨제한 115')
    expect(document.body.textContent).toContain('방어는 최선의 공격이지')
  })
  expect(requestedItemIds).toEqual(['weapon-1'])
})

it('검은 질병의, 억압 - 접두사가 붙은 무기는 접두사 없는 무기와 한 막대로 세고, 접두사 없는 무기의 itemId로 잇는다', async () => {
  const base = itemStatsWith(2)
  const itemStats = {
    ...base,
    slots: [
      {
        slotId: 'WEAPON',
        items: [
          { itemId: 'plague', name: '검은 질병의 멸룡검 발뭉', typeDetail: null, count: 30 },
          { itemId: 'balmung', name: '멸룡검 발뭉', typeDetail: null, count: 20 },
          { itemId: 'suppressed', name: '억압 - 요도 : 날뛰는 흑혈', typeDetail: null, count: 25 },
          { itemId: 'blood', name: '요도 : 날뛰는 흑혈', typeDetail: null, count: 10 },
          { itemId: 'other', name: '무기', typeDetail: null, count: 5 }
        ]
      },
      ...base.slots.slice(1)
    ]
  }
  await render({ setStats: setStatsOf(stats), itemStats: itemStatsOf(itemStats) })

  await vi.waitFor(() =>
    expect(rowsOf('무기')).toEqual([
      ['멸룡검 발뭉', '50.0%'],
      ['요도 : 날뛰는 흑혈', '35.0%'],
      ['무기', '5.0%']
    ])
  )
  expect(rankingSearchOf(rowLink('무기', '멸룡검 발뭉'))).toEqual({
    ...JOB_FILTER,
    itemIds: 'balmung'
  })
  expect(rankingSearchOf(rowLink('무기', '요도 : 날뛰는 흑혈'))).toEqual({
    ...JOB_FILTER,
    itemIds: 'blood'
  })
})

it('유일 장비는 네 아이템마다 아이콘, 이름과 착용 인원 한 줄이고, 아무도 끼지 않은 아이템은 0명이며, 그 itemId로 거른 랭킹으로 잇는다', async () => {
  const itemStats = { ...itemStatsWith(2), sampleSize: 200 }
  await render({ setStats: setStatsOf(stats), itemStats: itemStatsOf(itemStats) })

  await vi.waitFor(() =>
    expect(rowsOf('유일 장비')).toEqual([
      ['광휘를 머금은 눈동자', '72명'],
      ['만병을 잉태한 역병의 심장', '0명'],
      ['우아한 기품의 향수', '0명'],
      ['영롱한 날씨의 큐브', '50명']
    ])
  )
  expect(rankingSearchOf(rowLink('유일 장비', '광휘를 머금은 눈동자'))).toEqual({
    ...JOB_FILTER,
    itemIds: RING
  })
  expect(rankingSearchOf(rowLink('유일 장비', '영롱한 날씨의 큐브'))).toEqual({
    ...JOB_FILTER,
    itemIds: EARRING
  })

  const iconCount = boxOf('유일 장비').querySelectorAll('[data-chart-name] img').length

  expect(iconCount).toBe(4)
})

it('아이템 통계 저장분이 없으면 무기, 유일 장비 상자에 아이템 통계가 없다고 알린다', async () => {
  await render({ setStats: setStatsOf(stats), itemStats: itemStatsHandlers.empty })

  await vi.waitFor(() =>
    expect(boxOf('무기').querySelector('p.state')?.textContent).toBe('아이템 통계가 없습니다.')
  )
  expect(boxOf('유일 장비').querySelector('p.state')?.textContent).toBe('아이템 통계가 없습니다.')
})
