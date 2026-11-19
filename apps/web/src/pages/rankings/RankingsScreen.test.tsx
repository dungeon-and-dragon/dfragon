// @vitest-environment jsdom
import { type HttpHandler, HttpResponse, http } from 'msw'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ItemStats } from '#entities/ranking'
import type { OathCatalog } from '#entities/catalog'
import type { FameRanking, FameRankingFilter, RankedCharacter, SetStats } from '#entities/ranking'
import { oathCatalogHandlers } from '#entities/catalog/api/oath-catalog.handlers'
import {
  FAME_RANKING_NEXT_CURSOR,
  fameRankingFixture
} from '#entities/ranking/api/fame-ranking.fixture'
import { FAME_RANKING_URL, fameRankingFailure } from '#entities/ranking/api/fame-ranking.handlers'
import { ITEM_STATS_URL, itemStatsHandlers } from '#entities/ranking/api/item-stats.handlers'
import { SET_STATS_URL, setStatsHandlers } from '#entities/ranking/api/set-stats.handlers'
import { server } from '#testing/test-support/msw-server'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { TestRouter } from '#testing/test-support/test-router'
import { RankingsScreen } from './RankingsScreen'
import { RANKING_JOBS } from '#entities/character'

let container: HTMLDivElement
let root: Root
let requests: URLSearchParams[]
let setStatsQueries: Record<string, string>[]
let itemStatsQueries: Record<string, string>[]

beforeEach(() => {
  requests = []
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

function rankedCharacter(order: number, overrides: Partial<RankedCharacter> = {}): RankedCharacter {
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
    guildName: null,
    role: null,
    equipmentSet: null,
    oathSet: null,
    ...overrides
  }
}

function rankingOf(count: number): FameRanking {
  return {
    characters: Array.from({ length: count }, (_, index) => rankedCharacter(index + 1)),
    nextCursor: null
  }
}

// cursor는 요청에 붙은 다음 page cursor이고, 첫 page 요청이면 null이다.
type RankingResponse = (
  cursor: string | null
) => FameRanking | Response | Promise<FameRanking | Response>

function respondRanking(response: RankingResponse): void {
  server.use(
    http.get(FAME_RANKING_URL, async ({ request }) => {
      const params = new URL(request.url).searchParams
      requests.push(params)
      const body = await response(params.get('cursor'))

      if (body instanceof Response) {
        return body
      }

      return HttpResponse.json(body)
    })
  )
}

function queries(): Record<string, string>[] {
  return requests.map((params) => Object.fromEntries(params))
}

type StatsResponses = Readonly<{
  setStats?: HttpHandler
  oathCatalog?: HttpHandler
  itemStats?: HttpHandler
}>

async function render(
  ranking: RankingResponse,
  filter: FameRankingFilter = {},
  onFilterChange: (filter: FameRankingFilter) => void = () => {},
  {
    setStats = setStatsHandlers.loading,
    oathCatalog = oathCatalogHandlers.notUploaded,
    itemStats = itemStatsHandlers.loading
  }: StatsResponses = {}
): Promise<void> {
  respondRanking(ranking)
  server.use(setStats, oathCatalog, itemStats)
  await act(async () =>
    root.render(
      <TestQueryClient>
        <TestRouter>
          <RankingsScreen filter={filter} onFilterChange={onFilterChange} />
        </TestRouter>
      </TestQueryClient>
    )
  )
  await vi.waitFor(() => expect(container.textContent).not.toContain('검색 결과를 받는 중입니다.'))
}

function bodyRows(): HTMLTableRowElement[] {
  return [...container.querySelectorAll<HTMLTableRowElement>('tbody tr:not([aria-hidden])')]
}

function findButton(label: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) => button.textContent === label
  )
}

function chip(label: string): HTMLButtonElement {
  return findButton(label)!
}

function pagination(): HTMLElement {
  return container.querySelector<HTMLElement>('nav[aria-label="페이지"]')!
}

function pageButton(label: '이전' | '다음'): HTMLButtonElement {
  return [...pagination().querySelectorAll('button')].find(
    (button) => button.textContent === label
  )!
}

function showNext(): Promise<void> {
  return act(async () => pageButton('다음').click())
}

function showPrevious(): Promise<void> {
  return act(async () => pageButton('이전').click())
}

function firstCharacterName(): string | undefined {
  return bodyRows()[0]?.querySelector('a[href^="/c/"]')?.textContent
}

it('받은 100명을 한 페이지에 20명씩 보이고, 이전은 다시 받지 않고 앞 페이지를 보인다', async () => {
  await render(async () => rankingOf(100))

  expect(bodyRows()).toHaveLength(20)
  expect(firstCharacterName()).toBe('합성1')
  expect(pagination().textContent).toBe('이전1다음')
  expect(pageButton('이전').disabled).toBe(true)
  await showNext()
  expect(firstCharacterName()).toBe('합성21')
  expect(pagination().textContent).toBe('이전2다음')
  await showNext()
  await showNext()
  await showNext()
  expect(firstCharacterName()).toBe('합성81')
  expect(pageButton('다음').disabled).toBe(true)
  await showPrevious()

  expect(firstCharacterName()).toBe('합성61')
  expect(bodyRows()).toHaveLength(20)
  expect(requests).toHaveLength(1)
})

it('결과가 한 페이지면 이전과 다음을 모두 막는다', async () => {
  await render(async () => rankingOf(20))

  expect(pageButton('이전').disabled).toBe(true)
  expect(pageButton('다음').disabled).toBe(true)
})

it('3페이지에서 이미 받아 둔 필터로 바꿔도 1페이지를 보인다', async () => {
  const weapon = { itemIds: ['synthetic-weapon'] }
  await render(async () => rankingOf(100))
  await render(async () => rankingOf(100), weapon)
  await vi.waitFor(() => expect(firstCharacterName()).toBe('합성1'))
  await showNext()
  await showNext()
  expect(pagination().textContent).toBe('이전3다음')

  await render(async () => rankingOf(100))

  expect(pagination().textContent).toBe('이전1다음')
  expect(firstCharacterName()).toBe('합성1')
  expect(queries()).toEqual([{}, { itemIds: 'synthetic-weapon' }])
})

it('열은 캐릭터, 세트, 명성, 모험단이고 세트 값을 받은 적 없는 행은 세트를 -로 그린다', async () => {
  await render(async () => ({
    characters: [
      rankedCharacter(1, {
        guildName: '합성 길드',
        equipmentSet: {
          id: '7f788a703a87d783079b41d0fe6448c9',
          name: '영원히 이어지는 황금향 세트'
        },
        oathSet: { id: 16204, name: '야망의 용투 서약', option: '용투 : 용제 강림' }
      }),
      rankedCharacter(4, { level: null, jobGrowName: null, jobName: '합성 직업' })
    ],
    nextCursor: null
  }))

  expect([...container.querySelectorAll('thead th')].map((cell) => cell.textContent)).toEqual([
    '캐릭터',
    '세트',
    '명성',
    '모험단'
  ])
  const [first, fourth] = bodyRows().map((row) =>
    [...row.querySelectorAll('td')].map((cell) => cell.textContent)
  )
  expect(first).toEqual(['카인합성1합성 전직', '황금향용투 : 용제 강림', '99,999', '모험단1'])
  expect(fourth).toEqual(['카인합성4합성 직업', '-', '99,996', '모험단4'])
  expect(bodyRows()[0].querySelector('a')?.getAttribute('href')).toBe('/c/cain/character-1')
})

function characterLines(row: Element): (string | null)[] {
  const line = row.querySelector('a[href^="/c/"]')?.parentElement
  const nameLine = line?.textContent ?? null
  const levelLine = line?.nextElementSibling?.textContent ?? null

  return [nameLine, levelLine]
}

it('서버, 이름, 직업명을 한 줄로 두고, 만렙이 아니면 직업명 오른쪽 같은 줄에 레벨을 둔다', async () => {
  await render(async () => ({
    characters: [rankedCharacter(1), rankedCharacter(2, { level: 110 })],
    nextCursor: null
  }))

  const [maxLevel, belowMax] = bodyRows()
  expect(characterLines(maxLevel!)).toEqual(['카인합성1합성 전직', null])
  expect(characterLines(belowMax!)).toEqual(['카인합성2합성 전직Lv.110', null])
})

it('동명 전직에는 성별을 붙이고 남성 크루세이더는 역할을 알면 함께 표시한다', async () => {
  const maleCrusader = { jobName: '프리스트(남)', jobGrowName: '眞 크루세이더' }
  await render(async () => ({
    characters: [
      rankedCharacter(1, { ...maleCrusader, role: 'dealer' }),
      rankedCharacter(2, { ...maleCrusader, role: 'buffer' }),
      rankedCharacter(3, { ...maleCrusader, role: null }),
      rankedCharacter(4, { jobName: '프리스트(여)', jobGrowName: '眞 크루세이더', role: 'buffer' }),
      rankedCharacter(5, { jobName: '프리스트(남)', jobGrowName: '眞 인파이터', role: 'dealer' }),
      rankedCharacter(6, { jobName: '격투가(여)', jobGrowName: '眞 넨마스터' })
    ],
    nextCursor: null
  }))

  expect(bodyRows().map((row) => characterLines(row)[0])).toEqual([
    '카인합성1크루세이더(남, 딜러)',
    '카인합성2크루세이더(남, 버퍼)',
    '카인합성3크루세이더(남)',
    '카인합성4크루세이더(여)',
    '카인합성5인파이터(남)',
    '카인합성6넨마스터(여)'
  ])
})

it('빈 결과는 목록 상자에 빈 문구만 둔다', async () => {
  await render(async () => ({ characters: [], nextCursor: null }))

  expect(container.querySelector('section[aria-label="검색 결과"] p')?.textContent).toBe(
    '조건에 맞는 캐릭터가 없습니다.'
  )
  expect(container.querySelector('table')).toBeNull()
})

it('고른 직업으로 목록 이름을 바꾸고, 앞의 眞을 뺀 전직 이름 칩으로 필터 변경을 알린다', async () => {
  const [job] = RANKING_JOBS
  const onFilterChange = vi.fn()
  await render(async () => rankingOf(1), { jobId: job.jobId }, onFilterChange)

  expect(container.querySelector(`section[aria-label="${job.name} 검색 결과"]`)).not.toBeNull()
  expect(chip(job.name).hasAttribute('data-pressed')).toBe(true)
  expect(chip('직업 전체').hasAttribute('data-pressed')).toBe(false)
  await act(async () => chip('웨펀마스터').click())
  expect(onFilterChange).toHaveBeenLastCalledWith({
    jobId: job.jobId,
    jobGrowId: job.grows[0].jobGrowId
  })
  await act(async () => chip('직업 전체').click())
  expect(onFilterChange).toHaveBeenLastCalledWith({})
})

it('제국기사 칩을 고르면 목록 이름이 바뀌고, 브레이커 전직 칩으로 전직까지 넘긴다', async () => {
  const jobId = '8d4d2001cdb357e41633c234eb7501b5'
  const onFilterChange = vi.fn()
  await render(async () => rankingOf(1), {}, onFilterChange)

  await act(async () => chip('제국기사').click())
  expect(onFilterChange).toHaveBeenLastCalledWith({ jobId })

  await render(async () => rankingOf(1), { jobId }, onFilterChange)
  expect(container.querySelector('section[aria-label="제국기사 검색 결과"]')).not.toBeNull()
  await act(async () => chip('브레이커').click())
  expect(onFilterChange).toHaveBeenLastCalledWith({
    jobId,
    jobGrowId: '37495b941da3b1661bc900e68ef3b2c6'
  })
})

it('필터에 맞춰 직업, 전직을 넘겨 조회하고 실패하면 API 문구 대신 받지 못했다고 알린다', async () => {
  const [job] = RANKING_JOBS
  await render(() => fameRankingFailure('합성 API 오류'), {
    jobId: job.jobId,
    jobGrowId: job.grows[0].jobGrowId
  })

  expect(queries()).toEqual([{ jobId: job.jobId, jobGrowId: job.grows[0].jobGrowId }])
  expect(container.querySelector('[role="alert"]')?.textContent).toBe(
    '검색 결과를 받지 못했습니다.'
  )
})

const MALE_PRIEST = 'f6a4ad30555b99b499c07835f87ce522'
const CRUSADER = '37495b941da3b1661bc900e68ef3b2c6'

function chipLabels(): string[] {
  const growRow = [...container.querySelectorAll('h2')].find(
    (heading) => heading.textContent === '전직'
  )

  return [...(growRow?.parentElement?.querySelectorAll('button') ?? [])].map(
    (button) => button.textContent ?? ''
  )
}

it('프리스트(남)는 크루세이더 칩 대신 딜러, 버퍼 칩을 두고 고른 역할을 필터로 넘긴다', async () => {
  const onFilterChange = vi.fn()
  await render(async () => rankingOf(1), { jobId: MALE_PRIEST }, onFilterChange)

  expect(chipLabels()).toEqual([
    '전직 전체',
    '크루세이더(딜러)',
    '크루세이더(버퍼)',
    '인파이터',
    '퇴마사',
    '어벤저'
  ])
  await act(async () => chip('크루세이더(버퍼)').click())
  expect(onFilterChange).toHaveBeenLastCalledWith({
    jobId: MALE_PRIEST,
    jobGrowId: CRUSADER,
    role: 'buffer'
  })
  await act(async () => chip('인파이터').click())
  expect(onFilterChange).toHaveBeenLastCalledWith({
    jobId: MALE_PRIEST,
    jobGrowId: '618326026de1a1f1cfba5dbd0b8396e7'
  })
})

it('크루세이더(딜러)를 고르면 역할로 조회하고 그 칩만 눌린 채 목록 이름에 전직과 역할을 쓴다', async () => {
  await render(async () => rankingOf(1), {
    jobId: MALE_PRIEST,
    jobGrowId: CRUSADER,
    role: 'dealer'
  })

  expect(queries()).toEqual([{ jobId: MALE_PRIEST, jobGrowId: CRUSADER, role: 'dealer' }])
  expect(
    container.querySelector('section[aria-label="프리스트(남) 크루세이더(딜러) 검색 결과"]')
  ).not.toBeNull()
  expect(chip('크루세이더(딜러)').hasAttribute('data-pressed')).toBe(true)
  expect(chip('크루세이더(버퍼)').hasAttribute('data-pressed')).toBe(false)
  expect(chip('전직 전체').hasAttribute('data-pressed')).toBe(false)
})

function rankingPage(from: number, count: number, nextCursor: string | null): FameRanking {
  const characters = Array.from({ length: count }, (_, index) => rankedCharacter(from + index))

  return { characters, nextCursor }
}

function characterLinks(): string[] {
  return bodyRows().map((row) => row.querySelector('a[href^="/c/"]')?.getAttribute('href') ?? '')
}

function characterLinkOf({ serverId, characterId }: RankedCharacter): string {
  return `/c/${serverId}/${characterId}`
}

it('받아 둔 행을 넘는 페이지로 가면 nextCursor로 한 번 더 받고, 마지막 페이지 뒤에는 더 받지 않는다', async () => {
  await render(async (cursor) => {
    if (cursor === null) {
      return fameRankingFixture.firstPage
    }

    return fameRankingFixture.lastPage
  })

  for (let step = 0; step < 4; step += 1) {
    await showNext()
  }
  expect(requests).toHaveLength(1)
  await showNext()
  await vi.waitFor(() => expect(characterLinks()).toHaveLength(20))
  expect(queries()).toEqual([{}, { cursor: FAME_RANKING_NEXT_CURSOR }])
  expect(characterLinks()[0]).toBe(characterLinkOf(fameRankingFixture.lastPage.characters[0]!))
  await showNext()

  expect(characterLinks()).toHaveLength(10)
  expect(pagination().textContent).toBe('이전7다음')
  expect(pageButton('다음').disabled).toBe(true)
  expect(requests).toHaveLength(2)
})

it('다음 페이지를 받는 동안 표 자리에 빈 줄을 두고 이전, 다음을 막으며, 받으면 그 페이지를 보인다', async () => {
  let finish: (page: FameRanking) => void = () => {}
  await render(async (cursor) => {
    if (cursor === null) {
      return rankingPage(1, 20, 'page-2')
    }

    return new Promise<FameRanking>((resolve) => {
      finish = resolve
    })
  })
  await showNext()

  await vi.waitFor(() => expect(container.querySelectorAll('tr[aria-hidden]')).toHaveLength(5))
  expect(bodyRows()).toHaveLength(0)
  expect(pagination().textContent).toBe('이전2다음')
  expect(pageButton('이전').disabled).toBe(true)
  expect(pageButton('다음').disabled).toBe(true)
  await vi.waitFor(() => expect(requests).toHaveLength(2))
  await act(async () => finish(rankingPage(21, 5, null)))
  await vi.waitFor(() => expect(container.querySelectorAll('tr[aria-hidden]')).toHaveLength(0))
  expect(firstCharacterName()).toBe('합성21')
  expect(characterLinks()).toHaveLength(5)
  expect(pageButton('이전').disabled).toBe(false)
  expect(pageButton('다음').disabled).toBe(true)
})

function headings(): string[] {
  return [...container.querySelectorAll('thead th')].map((th) => th.textContent ?? '')
}

it('명성 범위를 query로 보내고, 최고 명성이 있든 없든 순위 열 없이 그린다', async () => {
  await render(async () => rankingOf(3), { fameFrom: 136000, fameTo: 138000 })

  expect(queries()).toEqual([{ fameFrom: '136000', fameTo: '138000' }])
  expect(headings()).toEqual(['캐릭터', '세트', '명성', '모험단'])
  await render(async () => rankingOf(3), { fameFrom: 136000 })
  expect(queries()).toEqual([{ fameFrom: '136000', fameTo: '138000' }, { fameFrom: '136000' }])
  expect(headings()).toEqual(['캐릭터', '세트', '명성', '모험단'])
})

it('고른 필터가 없으면 초기화를 막고, 필터를 골랐으면 초기화로 모든 필터를 지운다', async () => {
  const onFilterChange = vi.fn()
  await render(async () => rankingOf(1), {}, onFilterChange)

  expect(chip('초기화').disabled).toBe(true)
  await render(
    async () => rankingOf(1),
    {
      jobId: MALE_PRIEST,
      jobGrowId: CRUSADER,
      role: 'buffer',
      equipmentSetId: GOLDEN,
      itemIds: ['synthetic-weapon'],
      fameFrom: 136000,
      fameTo: 138000
    },
    onFilterChange
  )
  expect(chip('초기화').disabled).toBe(false)
  await act(async () => chip('초기화').click())
  expect(onFilterChange).toHaveBeenLastCalledWith({})
})

it('다음 페이지를 받지 못하면 오류 아래 다시 시도를 두고 이전만 누를 수 있으며, 다시 시도하면 그 페이지를 보인다', async () => {
  let failNext = true
  await render(async (cursor) => {
    if (cursor === null) {
      return rankingPage(1, 20, 'page-2')
    }

    if (failNext) {
      failNext = false

      return fameRankingFailure('합성 API 오류')
    }

    return rankingPage(21, 5, null)
  })
  await showNext()

  await vi.waitFor(() =>
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      '검색 결과를 받지 못했습니다.'
    )
  )
  expect(pageButton('이전').disabled).toBe(false)
  expect(pageButton('다음').disabled).toBe(true)
  await act(async () => chip('다시 시도').click())

  await vi.waitFor(() => expect(characterLinks()).toHaveLength(5))
  expect(firstCharacterName()).toBe('합성21')
  expect(container.querySelector('[role="alert"]')).toBeNull()
})

const GOLDEN = '7f788a703a87d783079b41d0fe6448c9'
const FAIRY = '4ee7bd5912cda6e2a24c1f36d5202b46'
const DRAGON = 16204

// 합성 세트 통계와 서약 카탈로그다. 세트 id, 이름, 선택지 이름은 게임 데이터 그대로다.
const setStats: SetStats = {
  computedAt: '2026-11-18T11:00:27.845Z',
  sampleSize: 6,
  equipmentSets: [
    { setId: FAIRY, name: '소울 페어리 세트', count: 1 },
    { setId: GOLDEN, name: '영원히 이어지는 황금향 세트', count: 3 },
    { setId: null, name: null, count: 2 }
  ],
  oathSets: [
    {
      setId: DRAGON,
      name: '야망의 용투 서약',
      count: 4,
      options: [{ name: '용투 : 용제 강림', count: 4 }]
    },
    { setId: null, name: null, count: 2, options: [{ name: null, count: 2 }] }
  ],
  combos: [{ equipmentSetId: null, oathSetId: null, count: 6 }]
}

const oathCatalog: OathCatalog = {
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

function setStatsOf(body: SetStats): HttpHandler {
  return http.get(SET_STATS_URL, ({ request }) => {
    setStatsQueries.push(Object.fromEntries(new URL(request.url).searchParams))

    return HttpResponse.json(body)
  })
}

function setResponses(): StatsResponses {
  return { setStats: setStatsOf(setStats), oathCatalog: oathCatalogHandlers.catalog(oathCatalog) }
}

function setSelect(label: string): HTMLButtonElement {
  return container.querySelector<HTMLButtonElement>(`[role="combobox"][aria-label="${label}"]`)!
}

async function pickOption(label: string, optionText: string): Promise<void> {
  await act(async () => setSelect(label).click())
  const option = await vi.waitFor(() => {
    const listbox = document.querySelector(`[role="listbox"][aria-label="${label}"]`)!
    const found = [...listbox.querySelectorAll<HTMLElement>('[role="option"]')].find(
      (item) => item.textContent === optionText
    )
    expect(found).toBeDefined()

    return found!
  })
  await act(async () => option.click())
}

function optionTexts(label: string): string[] {
  const listbox = document.querySelector(`[role="listbox"][aria-label="${label}"]`)

  return [...(listbox?.querySelectorAll('[role="option"]') ?? [])].map(
    (item) => item.textContent ?? ''
  )
}

it('세트 셀렉트는 전체 직업 세트 통계에서 많이 낀 순으로 세트를 두고, 선택지는 카탈로그 순서로 줄여 쓴다', async () => {
  await render(
    async () => rankingOf(1),
    { jobId: RANKING_JOBS[0].jobId, oathSetId: DRAGON },
    () => {},
    setResponses()
  )

  await act(async () => setSelect('장비 세트').click())
  await vi.waitFor(() =>
    expect(optionTexts('장비 세트')).toEqual(['장비 세트 전체', '황금향', '페어리'])
  )
  expect(setStatsQueries).toEqual([{}])
  await act(async () => setSelect('서약 선택지').click())
  await vi.waitFor(() =>
    expect(optionTexts('서약 선택지')).toEqual([
      '선택지 전체',
      '용투 : 첫 번째',
      '용투 : 두 번째',
      '용투 : 세 번째'
    ])
  )
})

it('세트를 고르면 직업 필터와 함께 넘기고, 서약 세트를 바꾸면 고른 선택지를 지운다', async () => {
  const onFilterChange = vi.fn()
  const jobId = RANKING_JOBS[0].jobId
  await render(
    async () => rankingOf(1),
    { jobId, oathSetId: DRAGON, oathSetOption: '용투 : 용제 강림' },
    onFilterChange,
    setResponses()
  )

  await pickOption('장비 세트', '황금향')
  expect(onFilterChange).toHaveBeenLastCalledWith({
    jobId,
    equipmentSetId: GOLDEN,
    oathSetId: DRAGON,
    oathSetOption: '용투 : 용제 강림'
  })
  await pickOption('서약 세트', '서약 세트 전체')
  expect(onFilterChange).toHaveBeenLastCalledWith({ jobId })
  await act(async () => chip('직업 전체').click())
  expect(onFilterChange).toHaveBeenLastCalledWith({
    oathSetId: DRAGON,
    oathSetOption: '용투 : 용제 강림'
  })
})

it('세트로 거르면 세트를 query로 보내고 목록 띠 제목에 고른 세트를 쓴다', async () => {
  const filter = { equipmentSetId: GOLDEN, oathSetId: DRAGON, oathSetOption: '용투 : 용제 강림' }
  await render(
    async () => rankingOf(1),
    filter,
    () => {},
    setResponses()
  )

  expect(queries()).toEqual([{ ...filter, oathSetId: String(DRAGON) }])
  await vi.waitFor(() =>
    expect(
      container.querySelector('section[aria-label="황금향 용투 : 두 번째 검색 결과"]')
    ).not.toBeNull()
  )
  expect(setSelect('장비 세트').textContent).toContain('황금향')
  expect(setSelect('서약 선택지').textContent).toContain('용투 : 두 번째')
})

it('거른 결과가 비면 조건에 맞는 캐릭터가 없다고 알린다', async () => {
  await render(
    async () => ({ characters: [], nextCursor: null }),
    { oathSetId: DRAGON },
    () => {},
    setResponses()
  )

  expect(container.querySelector('p.state')?.textContent).toBe('조건에 맞는 캐릭터가 없습니다.')
})

// 합성 아이템 통계다. 유일 장비 이름은 게임 데이터 그대로다.
function itemStatsOf(weapons: readonly [string, number][]): ItemStats {
  return {
    computedAt: '2026-11-18T15:38:47.900Z',
    sampleSize: 10,
    slots: [
      {
        slotId: 'WEAPON',
        items: weapons.map(([itemId, count]) => ({
          itemId,
          name: `무기 ${itemId}`,
          typeDetail: null,
          count
        }))
      },
      {
        slotId: 'RING',
        items: [{ itemId: 'ring-1', name: '광휘를 머금은 눈동자', typeDetail: null, count: 7 }]
      },
      {
        slotId: 'SUPPORT',
        items: [
          { itemId: 'support-2', name: '합성 보조장비', typeDetail: null, count: 2 },
          { itemId: 'support-1', name: '만병을 잉태한 역병의 심장', typeDetail: null, count: 6 }
        ]
      }
    ]
  }
}

function itemResponses(stats: ItemStats): StatsResponses {
  return {
    itemStats: http.get(ITEM_STATS_URL, ({ request }) => {
      itemStatsQueries.push(Object.fromEntries(new URL(request.url).searchParams))

      return HttpResponse.json(stats)
    })
  }
}

it('무기 셀렉트는 고른 직업, 전직의 아이템 통계에서 많이 낀 순이고, 유일 장비는 부위마다 착용 칩 하나다', async () => {
  const jobId = RANKING_JOBS[0].jobId
  await render(
    async () => rankingOf(1),
    { jobId },
    () => {},
    itemResponses(
      itemStatsOf([
        ['weapon-b', 1],
        ['weapon-a', 3]
      ])
    )
  )

  await act(async () => setSelect('무기').click())
  await vi.waitFor(() =>
    expect(optionTexts('무기')).toEqual(['무기 전체', '무기 weapon-a', '무기 weapon-b'])
  )
  expect(itemStatsQueries).toEqual([{ jobId }])
  const uniqueRow = [...container.querySelectorAll('h2')].find(
    (heading) => heading.textContent === '유일 장비'
  )?.parentElement
  expect(
    [...(uniqueRow?.querySelectorAll('button') ?? [])].map((button) => button.textContent)
  ).toEqual(['반지 착용', '보조장비 착용'])
})

it('무기는 하나만 골라 바꾸고, 착용 칩은 그 부위 유일 장비 itemId를 넣고 뺀다', async () => {
  const onFilterChange = vi.fn()
  const responses = itemResponses(
    itemStatsOf([
      ['weapon-a', 3],
      ['weapon-b', 1]
    ])
  )
  await render(
    async () => rankingOf(1),
    { itemIds: ['ring-1', 'weapon-a'] },
    onFilterChange,
    responses
  )

  await pickOption('무기', '무기 weapon-b')
  expect(onFilterChange).toHaveBeenLastCalledWith({ itemIds: ['ring-1', 'weapon-b'] })
  await act(async () => chip('보조장비 착용').click())
  expect(onFilterChange).toHaveBeenLastCalledWith({
    itemIds: ['ring-1', 'weapon-a', 'support-1']
  })
  await act(async () => chip('반지 착용').click())
  expect(onFilterChange).toHaveBeenLastCalledWith({ itemIds: ['weapon-a'] })
})

it('고른 전직의 아이템 통계에 없는 무기 필터는 지우고 유일 장비 필터는 남긴다', async () => {
  const onFilterChange = vi.fn()
  const responses = itemResponses(itemStatsOf([['weapon-a', 3]]))
  const jobId = RANKING_JOBS[0].jobId
  await render(
    async () => rankingOf(1),
    { jobId, itemIds: ['ring-1', 'other-job-weapon'] },
    onFilterChange,
    responses
  )

  await vi.waitFor(() =>
    expect(onFilterChange).toHaveBeenLastCalledWith({ jobId, itemIds: ['ring-1'] })
  )
})

it('아이템 통계가 비어 있으면 주소의 아이템 필터를 지우지 않는다', async () => {
  const onFilterChange = vi.fn()
  const empty: ItemStats = { computedAt: null, sampleSize: 0, slots: [] }
  let answered: () => void = () => {}
  const itemStatsAnswered = new Promise<void>((resolve) => {
    answered = resolve
  })
  const itemStats = http.get(ITEM_STATS_URL, () => {
    answered()

    return HttpResponse.json(empty)
  })
  // 빈 아이템 통계를 받은 뒤 화면이 필터를 지우지 않았는지 보려고, 랭킹은 아이템 통계에 응답한 뒤에 돌려준다.
  await render(
    async () => {
      await itemStatsAnswered

      return rankingOf(1)
    },
    { itemIds: ['weapon-x'] },
    onFilterChange,
    { itemStats }
  )

  expect(queries()).toEqual([{ itemIds: 'weapon-x' }])
  expect(onFilterChange).not.toHaveBeenCalled()
})

const SEPARATOR = '---'

// 셀렉트 목록의 줄을 위에서부터 [묶음 라벨, ...무기]로 읽는다. 묶음이 아닌 무기는 라벨이 null이고 구분선은 SEPARATOR다.
function weaponOptionGroups(): (string | null)[][] {
  const listbox = document.querySelector('[role="listbox"][aria-label="무기"]')!

  return [...listbox.children].map((child) => {
    if (child.classList.contains('listbox-separator')) {
      return [SEPARATOR]
    }

    if (child.getAttribute('role') === 'option') {
      return [null, child.textContent]
    }

    const label = child.querySelector('.listbox-group-label')?.textContent ?? null
    const options = [...child.querySelectorAll('[role="option"]')].map(
      (option) => option.textContent
    )

    return [label, ...options]
  })
}

it('직업을 고르지 않으면 무기를 종류별로 묶고, 종류는 그 안 최다 무기 순이며 종류를 모르는 무기는 묶음 없이 맨 끝이다', async () => {
  const stats: ItemStats = {
    computedAt: '2026-11-19T05:26:46.665Z',
    sampleSize: 25,
    slots: [
      {
        slotId: 'WEAPON',
        items: [
          { itemId: 'scythe-1', name: '낫1', typeDetail: '낫', count: 5 },
          { itemId: 'unknown-1', name: '모름1', typeDetail: null, count: 9 },
          { itemId: 'sword-1', name: '도1', typeDetail: '도', count: 6 },
          { itemId: 'scythe-2', name: '낫2', typeDetail: '낫', count: 4 },
          { itemId: 'sword-2', name: '도2', typeDetail: '도', count: 1 }
        ]
      }
    ]
  }
  await render(
    async () => rankingOf(1),
    {},
    () => {},
    itemResponses(stats)
  )

  await act(async () => setSelect('무기').click())
  await vi.waitFor(() =>
    expect(weaponOptionGroups()).toEqual([
      [null, '무기 전체'],
      ['도', '도1', '도2'],
      ['낫', '낫1', '낫2'],
      [SEPARATOR],
      [null, '모름1']
    ])
  )
})

it('직업을 고르면 무기를 묶지 않고 많이 낀 순으로 둔다', async () => {
  const stats: ItemStats = {
    computedAt: '2026-11-19T05:26:46.665Z',
    sampleSize: 20,
    slots: [
      {
        slotId: 'WEAPON',
        items: [
          { itemId: 'scythe-1', name: '낫1', typeDetail: '낫', count: 5 },
          { itemId: 'sword-1', name: '도1', typeDetail: '도', count: 6 }
        ]
      }
    ]
  }
  await render(
    async () => rankingOf(1),
    { jobId: RANKING_JOBS[0].jobId },
    () => {},
    itemResponses(stats)
  )

  await act(async () => setSelect('무기').click())
  await vi.waitFor(() =>
    expect(weaponOptionGroups()).toEqual([
      [null, '무기 전체'],
      [null, '도1'],
      [null, '낫1']
    ])
  )
})

it('직업을 고르지 않았을 때 주소에만 있는 무기는 묶음 앞에 따로 두어 고른 값으로 보인다', async () => {
  const stats: ItemStats = {
    computedAt: '2026-11-19T05:26:46.665Z',
    sampleSize: 20,
    slots: [
      {
        slotId: 'WEAPON',
        items: [{ itemId: 'sword-1', name: '도1', typeDetail: '도', count: 6 }]
      }
    ]
  }
  await render(
    async () => rankingOf(1),
    { itemIds: ['gone-weapon'] },
    () => {},
    itemResponses(stats)
  )

  expect(setSelect('무기').textContent).toContain('gone-weapon')
  await act(async () => setSelect('무기').click())
  await vi.waitFor(() =>
    expect(weaponOptionGroups()).toEqual([
      [null, '무기 전체'],
      [null, 'gone-weapon'],
      ['도', '도1']
    ])
  )
})
