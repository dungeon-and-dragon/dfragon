// @vitest-environment jsdom
import { type HttpHandler, HttpResponse, http } from 'msw'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ItemStats } from '#entities/ranking'
import type { OathCatalog } from '#entities/catalog'
import type { FameRanking, FameRankingFilter, RankedCharacter, SetStats } from '#entities/ranking'
import { oathCatalogHandlers } from '#entities/catalog/api/oath-catalog.handlers'
import { FAME_RANKING_URL, fameRankingFailure } from '#entities/ranking/api/fame-ranking.handlers'
import { ITEM_STATS_URL, itemStatsHandlers } from '#entities/ranking/api/item-stats.handlers'
import { SET_STATS_URL, setStatsHandlers } from '#entities/ranking/api/set-stats.handlers'
import {
  evolutionSkillStats,
  SKILL_STATS_URL,
  skillStatsHandlers
} from '#entities/ranking/api/skill-stats.handlers'
import { storyWeaponMasterCatalog } from '#entities/catalog/api/skill-window.fixture'
import { skillWindowHandlers } from '#entities/catalog/api/skill-window.handlers'
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
    score: null,
    equipmentSet: null,
    oathSet: null,
    ...overrides
  }
}

function rankingOf(count: number): FameRanking {
  const characters = Array.from({ length: count }, (_, index) => rankedCharacter(index + 1))
  const pageCount = count > 0 ? 1 : 0

  return { characters, pageCount }
}

// page는 요청에 붙은 쪽 번호이고, 붙지 않은 첫 쪽 요청이면 1이다.
type RankingResponse = (page: number) => FameRanking | Response | Promise<FameRanking | Response>

const PAGE_SIZE = 20

function rankingPage(page: number, total: number): FameRanking {
  const from = (page - 1) * PAGE_SIZE + 1
  const count = Math.max(0, Math.min(PAGE_SIZE, total - from + 1))
  const characters = Array.from({ length: count }, (_, index) => rankedCharacter(from + index))
  const pageCount = Math.ceil(total / PAGE_SIZE)

  return { characters, pageCount }
}

// API처럼 쪽 번호의 20명과 전체 쪽 수를 준다.
function rankingOfTotal(total: number): RankingResponse {
  return (page) => rankingPage(page, total)
}

function respondRanking(response: RankingResponse): void {
  server.use(
    http.get(FAME_RANKING_URL, async ({ request }) => {
      const params = new URL(request.url).searchParams
      requests.push(params)
      const page = Number(params.get('page') ?? '1')
      const body = await response(page)

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
  skillStats?: HttpHandler
  skillWindow?: readonly HttpHandler[]
}>

async function render(
  ranking: RankingResponse,
  filter: FameRankingFilter = {},
  onFilterChange: (filter: FameRankingFilter) => void = () => {},
  {
    setStats = setStatsHandlers.loading,
    oathCatalog = oathCatalogHandlers.notUploaded,
    itemStats = itemStatsHandlers.loading,
    skillStats = skillStatsHandlers.loading,
    skillWindow = skillWindowHandlers([])
  }: StatsResponses = {}
): Promise<void> {
  respondRanking(ranking)
  server.use(setStats, oathCatalog, itemStats, skillStats, ...skillWindow)
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

function currentPage(): string | null | undefined {
  return pagination().querySelector('[aria-current="page"]')?.textContent
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

async function showPageOf(firstName: string, click: () => Promise<void>): Promise<void> {
  await click()
  await vi.waitFor(() => expect(firstCharacterName()).toBe(firstName))
}

it('쪽마다 20명을 받아 보이고, 이전은 받아 둔 앞 쪽을 다시 받지 않는다', async () => {
  await render(rankingOfTotal(100))

  expect(bodyRows()).toHaveLength(20)
  expect(firstCharacterName()).toBe('합성1')
  expect(pagination().textContent).toBe('이전12345다음')
  expect(pageButton('이전').disabled).toBe(true)
  expect(currentPage()).toBe('1')
  await showPageOf('합성21', showNext)
  expect(currentPage()).toBe('2')
  await showPageOf('합성41', showNext)
  await showPageOf('합성61', showNext)
  await showPageOf('합성81', showNext)
  expect(pageButton('다음').disabled).toBe(true)
  await showPageOf('합성61', showPrevious)

  expect(bodyRows()).toHaveLength(20)
  expect(queries()).toEqual([{}, { page: '2' }, { page: '3' }, { page: '4' }, { page: '5' }])
})

it('번호를 누르면 그 쪽을 받아 보이고, API가 준 쪽 수로 누른 쪽을 가운데 둔다', async () => {
  await render(rankingOfTotal(1000))

  await showPageOf('합성81', () => act(async () => findButton('5')!.click()))

  expect(currentPage()).toBe('5')
  expect(pagination().textContent).toBe('이전34567다음')
  expect(queries()).toEqual([{}, { page: '5' }])
})

it('결과가 한 쪽이면 이전과 다음을 모두 막는다', async () => {
  await render(async () => rankingOf(20))

  expect(pageButton('이전').disabled).toBe(true)
  expect(pageButton('다음').disabled).toBe(true)
})

it('3쪽에서 필터를 바꾸면 1쪽을 보인다', async () => {
  const weapon = { itemIds: ['synthetic-weapon'] }
  await render(rankingOfTotal(100))
  await render(rankingOfTotal(100), weapon)
  await vi.waitFor(() => expect(firstCharacterName()).toBe('합성1'))
  await showPageOf('합성21', showNext)
  await showPageOf('합성41', showNext)
  expect(currentPage()).toBe('3')

  await render(rankingOfTotal(100))

  expect(currentPage()).toBe('1')
  expect(firstCharacterName()).toBe('합성1')
  expect(queries()).toEqual([
    {},
    { itemIds: 'synthetic-weapon' },
    { itemIds: 'synthetic-weapon', page: '2' },
    { itemIds: 'synthetic-weapon', page: '3' }
  ])
})

it('열은 캐릭터, 세트, 명성, 점수, 모험단이고 기준인 명성 헤더에 내림차순을 표시하며, 세트 값이나 점수가 없는 행은 그 칸을 -로 그린다', async () => {
  await render(async () => ({
    characters: [
      rankedCharacter(1, {
        guildName: '합성 길드',
        equipmentSet: {
          id: '7f788a703a87d783079b41d0fe6448c9',
          name: '영원히 이어지는 황금향 세트'
        },
        oathSet: { id: 16204, name: '야망의 용투 서약', option: '용투 : 용제 강림' },
        score: { calculator: 'equipment', value: 1_388_832, approximate: null }
      }),
      rankedCharacter(2, {
        role: 'buffer',
        score: { calculator: 'buff', value: 4_120_000, approximate: null }
      }),
      rankedCharacter(4, { level: null, jobGrowName: null, jobName: '합성 직업' })
    ],
    pageCount: 1
  }))

  expect([...container.querySelectorAll('thead th')].map((cell) => cell.textContent)).toEqual([
    '캐릭터',
    '세트',
    '명성',
    '점수',
    '모험단'
  ])
  expect(
    [...container.querySelectorAll('thead th[aria-sort="descending"]')].map(
      (cell) => cell.textContent
    )
  ).toEqual(['명성'])
  const [first, second, fourth] = bodyRows().map((row) =>
    [...row.querySelectorAll('td')].map((cell) => cell.textContent)
  )
  expect(first).toEqual([
    '카인합성1합성 전직99,9991,388,832모험단1',
    '황금향용투 : 용제 강림',
    '99,999',
    '1,388,832',
    '모험단1'
  ])
  expect(second?.[3]).toBe('4,120,000')
  expect(fourth).toEqual(['카인합성4합성 직업99,996-모험단4', '-', '99,996', '-', '모험단4'])
  expect(bodyRows()[0].querySelector('a')?.getAttribute('href')).toBe('/c/cain/character-1')
})

function characterLines(row: Element): (string | null)[] {
  const lines = row.querySelector('a[href^="/c/"]')?.closest('span.flex-col')?.children
  const nameLine = lines?.[0]?.textContent ?? null
  const levelLine = lines?.[1]?.textContent ?? null

  return [nameLine, levelLine]
}

it('서버, 이름, 직업명을 한 줄로 두고 만렙이 아니면 직업명 오른쪽 같은 줄에 레벨을, 다음 줄에 명성, 점수, 모험단을 둔다', async () => {
  await render(async () => ({
    characters: [rankedCharacter(1), rankedCharacter(2, { level: 110 })],
    pageCount: 1
  }))

  const [maxLevel, belowMax] = bodyRows()
  expect(characterLines(maxLevel!)).toEqual(['카인합성1합성 전직', '99,999-모험단1'])
  expect(characterLines(belowMax!)).toEqual(['카인합성2합성 전직Lv 110', '99,998-모험단2'])
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
    pageCount: 1
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
  await render(async () => ({ characters: [], pageCount: 0 }))

  expect(container.querySelector('section[aria-label="검색 결과"] p')?.textContent).toBe(
    '조건에 맞는 캐릭터가 없습니다.'
  )
  expect(container.querySelector('table')).toBeNull()
})

it('고른 직업으로 목록 이름을 바꾸고, 앞의 眞을 뺀 전직 이름 칩으로 필터 변경을 알리며, 고른 직업 칩을 다시 누르면 직업 전체로 돌린다', async () => {
  const [job] = RANKING_JOBS
  const onFilterChange = vi.fn()
  await render(async () => rankingOf(1), { jobId: job.jobId }, onFilterChange)

  expect(container.querySelector(`section[aria-label="${job.name} 검색 결과"]`)).not.toBeNull()
  expect(chip(job.name).hasAttribute('data-pressed')).toBe(true)
  expect(chip('직업 전체')).toBeUndefined()
  await act(async () => chip('웨펀마스터').click())
  expect(onFilterChange).toHaveBeenLastCalledWith({
    jobId: job.jobId,
    jobGrowId: job.grows[0].jobGrowId
  })
  await act(async () => chip(job.name).click())
  expect(onFilterChange).toHaveBeenLastCalledWith({})
})

it('전직이 하나뿐인 제국기사 칩을 고르면 그 전직까지 넘기고, 전직 줄에는 전직 전체 없이 브레이커만 고른 채로 보인다', async () => {
  const jobId = '8d4d2001cdb357e41633c234eb7501b5'
  const breaker = { jobId, jobGrowId: '37495b941da3b1661bc900e68ef3b2c6' }
  const onFilterChange = vi.fn()
  await render(async () => rankingOf(1), {}, onFilterChange)

  await act(async () => chip('제국기사').click())
  expect(onFilterChange).toHaveBeenLastCalledWith(breaker)

  await render(async () => rankingOf(1), breaker, onFilterChange)
  expect(container.querySelector('section[aria-label="제국기사 검색 결과"]')).not.toBeNull()
  expect(chipLabels()).toEqual(['브레이커'])
  expect(chip('브레이커').getAttribute('aria-pressed')).toBe('true')
})

it('예전 주소처럼 전직이 하나뿐인 직업만 있어도 그 전직을 고른 채로 보인다', async () => {
  await render(async () => rankingOf(1), { jobId: '8d4d2001cdb357e41633c234eb7501b5' })

  expect(chipLabels()).toEqual(['브레이커'])
  expect(chip('브레이커').getAttribute('aria-pressed')).toBe('true')
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

  return [...(growRow?.parentElement?.querySelectorAll('button[aria-pressed]') ?? [])].map(
    (button) => button.textContent ?? ''
  )
}

it('프리스트(남)는 크루세이더 칩 대신 딜러, 버퍼 칩을 두고 고른 역할을 필터로 넘긴다', async () => {
  const onFilterChange = vi.fn()
  await render(async () => rankingOf(1), { jobId: MALE_PRIEST }, onFilterChange)

  expect(chipLabels()).toEqual([
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

it('크루세이더(딜러)를 고르면 역할로 조회하고 그 칩만 눌린 채 목록 이름에 전직과 역할을 쓰며, 다시 누르면 전직 전체로 돌린다', async () => {
  const onFilterChange = vi.fn()
  await render(
    async () => rankingOf(1),
    { jobId: MALE_PRIEST, jobGrowId: CRUSADER, role: 'dealer' },
    onFilterChange
  )

  expect(queries()).toEqual([{ jobId: MALE_PRIEST, jobGrowId: CRUSADER, role: 'dealer' }])
  expect(
    container.querySelector('section[aria-label="프리스트(남) 크루세이더(딜러) 검색 결과"]')
  ).not.toBeNull()
  expect(chip('크루세이더(딜러)').hasAttribute('data-pressed')).toBe(true)
  expect(chip('크루세이더(버퍼)').hasAttribute('data-pressed')).toBe(false)
  await act(async () => chip('크루세이더(딜러)').click())
  expect(onFilterChange).toHaveBeenLastCalledWith({ jobId: MALE_PRIEST })
})

function characterLinks(): string[] {
  return bodyRows().map((row) => row.querySelector('a[href^="/c/"]')?.getAttribute('href') ?? '')
}

it('다른 쪽을 받는 동안 표 자리에 빈 줄을 두고 이전, 번호, 다음을 막으며, 받으면 그 쪽을 보인다', async () => {
  let finish: (page: FameRanking) => void = () => {}
  await render(async (page) => {
    if (page === 1) {
      return rankingPage(1, 25)
    }

    return new Promise<FameRanking>((resolve) => {
      finish = resolve
    })
  })
  await showNext()

  await vi.waitFor(() => expect(container.querySelectorAll('tr[aria-hidden]')).toHaveLength(5))
  expect(bodyRows()).toHaveLength(0)
  expect(pagination().textContent).toBe('이전12다음')
  expect(currentPage()).toBe('2')
  expect([...pagination().querySelectorAll('button')].map((button) => button.disabled)).toEqual([
    true,
    true,
    true
  ])
  await act(async () => finish(rankingPage(2, 25)))
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
  expect(headings()).toEqual(['캐릭터', '세트', '명성', '점수', '모험단'])
  await render(async () => rankingOf(3), { fameFrom: 136000 })
  expect(queries()).toEqual([{ fameFrom: '136000', fameTo: '138000' }, { fameFrom: '136000' }])
  expect(headings()).toEqual(['캐릭터', '세트', '명성', '점수', '모험단'])
})

it('고른 필터가 없으면 초기화를 막고, 필터를 골랐으면 초기화로 개화 선택까지 모든 필터를 지운다', async () => {
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
      evolutions: [{ name: '발도', type: 1 }],
      fameFrom: 136000,
      fameTo: 138000
    },
    onFilterChange
  )
  expect(chip('초기화').disabled).toBe(false)
  await act(async () => chip('초기화').click())
  expect(onFilterChange).toHaveBeenLastCalledWith({})
})

it('다른 쪽을 받지 못하면 오류와 함께 이전만 누를 수 있게 두고, 이전을 누르면 앞 쪽을 보인다', async () => {
  await render(async (page) => {
    if (page === 1) {
      return rankingPage(1, 25)
    }

    return fameRankingFailure('합성 API 오류')
  })
  await showNext()

  await vi.waitFor(() =>
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      '검색 결과를 받지 못했습니다.'
    )
  )
  expect(pageButton('이전').disabled).toBe(false)
  expect(pageButton('다음').disabled).toBe(true)
  await showPageOf('합성1', showPrevious)

  expect(container.querySelector('[role="alert"]')).toBeNull()
  expect(currentPage()).toBe('1')
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
    { setId: GOLDEN, name: '영원히 이어지는 황금향 세트', count: 2 },
    { setId: 'b9403caf99c157682d1d468d899e9aaa', name: '차원 속의 이야기 세트', count: 1 },
    { setId: '13f6edd6dc195fdb8bc76b8349078ef6', name: '오디세이 고급 세트', count: 1 },
    { setId: null, name: null, count: 1 }
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
      options: ['용제 강림', '세계를 태우는 불꽃', '싸워야만 하는 운명'].map((name) => ({
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

it('세트 셀렉트는 전체 직업 세트 통계에서 오디세이 고급, 차원 속의 이야기 세트를 빼고 많이 낀 순으로 세트를 두고, 선택지는 카탈로그 순서로 줄여 쓴다', async () => {
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
  expect(setStatsQueries).toEqual([{ sample: 'all' }])
  await act(async () => setSelect('서약 선택지').click())
  await vi.waitFor(() =>
    expect(optionTexts('서약 선택지')).toEqual([
      '선택지 전체',
      '용투장 : 왼쪽',
      '용투장 : 가운데',
      '용투장 : 오른쪽'
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
  await act(async () => chip(RANKING_JOBS[0].name).click())
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
      container.querySelector('section[aria-label="황금향 용투장 : 왼쪽 검색 결과"]')
    ).not.toBeNull()
  )
  expect(setSelect('장비 세트').textContent).toContain('황금향')
  expect(setSelect('서약 선택지').textContent).toContain('용투장 : 왼쪽')
})

it('거른 결과가 비면 조건에 맞는 캐릭터가 없다고 알린다', async () => {
  await render(
    async () => ({ characters: [], pageCount: 0 }),
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

function optionGroups(label: string): string[][] {
  const listbox = document.querySelector(`[role="listbox"][aria-label="${label}"]`)

  return [...(listbox?.querySelectorAll('[role="group"]') ?? [])].map((group) =>
    [...group.children].map((child) => child.textContent ?? '')
  )
}

function optionIcons(label: string): number[] {
  const listbox = document.querySelector(`[role="listbox"][aria-label="${label}"]`)

  return [...(listbox?.querySelectorAll('[role="option"]') ?? [])].map(
    (option) => option.querySelectorAll('img').length
  )
}

it('무기 셀렉트는 많이 낀 순에 무기마다 아이콘을 두고, 유일 장비 셀렉트는 부위별로 묶어 많이 낀 순으로 둔다', async () => {
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
  expect(optionIcons('무기')).toEqual([0, 1, 1])
  expect(itemStatsQueries).toEqual([{ jobId, sample: 'all' }])
  await act(async () => setSelect('유일 장비').click())
  await vi.waitFor(() =>
    expect(optionGroups('유일 장비')).toEqual([
      ['반지', '광휘를 머금은 눈동자'],
      ['보조장비', '만병을 잉태한 역병의 심장', '합성 보조장비']
    ])
  )
  expect(optionIcons('유일 장비')).toEqual([1, 1, 1])
})

it('무기는 하나만 골라 바꾸고, 유일 장비는 다른 부위를 더하고 고른 것을 다시 누르면 뺀다', async () => {
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
  await pickOption('유일 장비', '만병을 잉태한 역병의 심장')
  expect(onFilterChange).toHaveBeenLastCalledWith({
    itemIds: ['ring-1', 'support-1', 'weapon-a']
  })
  await pickOption('유일 장비', '광휘를 머금은 눈동자')
  expect(onFilterChange).toHaveBeenLastCalledWith({ itemIds: ['weapon-a'] })
})

it('같은 부위의 다른 유일 장비를 고르면 그 부위의 선택을 바꾸고 개수는 늘리지 않는다', async () => {
  const onFilterChange = vi.fn()
  await render(
    async () => rankingOf(1),
    { itemIds: ['support-2', 'ring-1'] },
    onFilterChange,
    itemResponses(itemStatsOf([['weapon-a', 3]]))
  )

  await pickOption('유일 장비', '만병을 잉태한 역병의 심장')

  expect(onFilterChange).toHaveBeenLastCalledWith({ itemIds: ['ring-1', 'support-1'] })
})

it('itemIds가 든 주소로 들어오면 닫힌 셀렉트에 고른 무기의 아이콘과 이름, 유일 장비의 아이콘과 이름이나 개수를 보인다', async () => {
  const responses = itemResponses(itemStatsOf([['weapon-a', 3]]))
  await render(
    async () => rankingOf(1),
    { itemIds: ['ring-1', 'weapon-a'] },
    () => {},
    responses
  )

  await vi.waitFor(() => expect(setSelect('유일 장비').textContent).toBe('광휘를 머금은 눈동자'))
  expect(setSelect('유일 장비').querySelectorAll('img')).toHaveLength(1)
  expect(setSelect('무기').textContent).toBe('무기 weapon-a')
  expect(setSelect('무기').querySelectorAll('img')).toHaveLength(1)
  await render(
    async () => rankingOf(1),
    { itemIds: ['ring-1', 'support-1'] },
    () => {},
    responses
  )

  await vi.waitFor(() => expect(setSelect('유일 장비').textContent).toBe('2개'))
  expect(setSelect('유일 장비').querySelectorAll('img')).toHaveLength(2)
  expect(setSelect('무기').querySelectorAll('img')).toHaveLength(0)
})

it('무기를 포함해 5개를 고르면 고르지 않은 부위의 유일 장비는 막고, 고른 부위의 다른 아이템은 둔다', async () => {
  const base = itemStatsOf([['weapon-a', 3]])
  // 무기와 유일 장비 넷으로 한도에 닿은 뒤에도 고르지 않은 부위가 남도록 합성 부위 셋을 더해 다섯 부위로 만든다.
  const stats: ItemStats = {
    ...base,
    slots: [
      ...base.slots,
      ...['EARRING', 'MAGIC_STONE', 'SYNTHETIC'].map((slotId) => ({
        slotId,
        items: [{ itemId: `${slotId}-1`, name: `합성 ${slotId}`, typeDetail: null, count: 1 }]
      }))
    ]
  }
  await render(
    async () => rankingOf(1),
    { itemIds: ['weapon-a', 'ring-1', 'support-2', 'EARRING-1', 'MAGIC_STONE-1'] },
    () => {},
    itemResponses(stats)
  )

  await act(async () => setSelect('유일 장비').click())
  const option = (name: string) =>
    [...document.querySelectorAll('[role="listbox"][aria-label="유일 장비"] [role="option"]')].find(
      (item) => item.textContent === name
    )
  await vi.waitFor(() => expect(option('합성 SYNTHETIC')).toBeDefined())

  expect(option('합성 SYNTHETIC')?.hasAttribute('data-disabled')).toBe(true)
  expect(option('만병을 잉태한 역병의 심장')?.hasAttribute('data-disabled')).toBe(false)
})

it('아이템 아이콘을 받지 못해도 옵션 이름은 보인다', async () => {
  await render(
    async () => rankingOf(1),
    {},
    () => {},
    itemResponses(itemStatsOf([['weapon-a', 3]]))
  )

  await act(async () => setSelect('유일 장비').click())
  await vi.waitFor(() => expect(optionIcons('유일 장비')).toEqual([1, 1, 1]))
  const icon = document.querySelector('[role="listbox"][aria-label="유일 장비"] img')!
  await act(async () => icon.dispatchEvent(new Event('error')))

  expect(optionIcons('유일 장비')).toEqual([0, 1, 1])
  expect(optionTexts('유일 장비')).toEqual([
    '광휘를 머금은 눈동자',
    '만병을 잉태한 역병의 심장',
    '합성 보조장비'
  ])
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

const WEAPON_MASTER = RANKING_JOBS[0]
const GROW_FILTER: FameRankingFilter = {
  jobId: WEAPON_MASTER.jobId,
  jobGrowId: WEAPON_MASTER.grows[0].jobGrowId
}

function evolutionResponses(names: readonly string[] = ['발도', '환영검무']): StatsResponses {
  return {
    skillStats: skillStatsHandlers.of(evolutionSkillStats(names)),
    skillWindow: skillWindowHandlers([storyWeaponMasterCatalog])
  }
}

function rowLabels(): string[] {
  return [...container.querySelectorAll('h2')].map((heading) => heading.textContent ?? '')
}

function evolutionButton(label: string): HTMLButtonElement {
  return container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!
}

it('직업이나 전직을 고르지 않으면 스킬 개화 줄을 두지 않고 개화 스킬도 받지 않는다', async () => {
  let skillStatsRequests = 0
  const responses: StatsResponses = {
    ...evolutionResponses(),
    skillStats: http.get(SKILL_STATS_URL, () => {
      skillStatsRequests += 1

      return HttpResponse.json(evolutionSkillStats(['발도']))
    })
  }
  await render(
    async () => rankingOf(1),
    {},
    () => {},
    responses
  )
  await render(
    async () => rankingOf(1),
    { jobId: WEAPON_MASTER.jobId },
    () => {},
    responses
  )

  expect(rowLabels()).not.toContain('스킬 개화')
  expect(skillStatsRequests).toBe(0)
})

it('전직을 고르면 스킬 개화 줄에 스킬마다 개화 이름 두 개를 두고, 개화를 고르면 그 선택을 필터로 넘긴다', async () => {
  const onFilterChange = vi.fn()
  await render(async () => rankingOf(1), GROW_FILTER, onFilterChange, evolutionResponses())

  await vi.waitFor(() => expect(evolutionButton('발도 명가의 손놀림')).not.toBeNull())
  expect(rowLabels()).toContain('스킬 개화')
  expect(
    [...container.querySelectorAll('button[aria-pressed]')]
      .map((button) => button.getAttribute('aria-label'))
      .filter((label) => label?.startsWith('발도') || label?.startsWith('환영검무'))
  ).toEqual(['발도 명가의 손놀림', '발도 속전속결', '환영검무 그림자 유희', '환영검무 무형검무'])
  await act(async () => evolutionButton('발도 명가의 손놀림').click())

  expect(onFilterChange).toHaveBeenLastCalledWith({
    ...GROW_FILTER,
    evolutions: [{ name: '발도', type: 1 }]
  })
})

it('스킬 개화의 갈래 버튼에 마우스를 올리면 그 갈래의 개화 이름과 설명을 Tooltip으로 보인다', async () => {
  await render(
    async () => rankingOf(1),
    GROW_FILTER,
    () => {},
    evolutionResponses()
  )
  await vi.waitFor(() => expect(evolutionButton('발도 속전속결')).not.toBeNull())

  await act(async () => {
    evolutionButton('발도 속전속결').dispatchEvent(new MouseEvent('mouseenter'))
  })

  const popup = await vi.waitFor(() => {
    const open = document.querySelector('[data-base-ui-portal] > [data-open]')
    if (open === null) {
      throw new Error('Tooltip이 열리지 않았다')
    }

    return open
  })
  expect(popup.textContent).toBe('Ⅱ 속전속결합성 설명합성 설명')
})

it('고른 개화가 든 필터로 들어오면 그 개화를 눌린 채 두고 목록 요청에 개화를 붙이며, 다른 개화를 누르면 그 스킬의 선택만 바꾼다', async () => {
  const onFilterChange = vi.fn()
  const filter: FameRankingFilter = {
    ...GROW_FILTER,
    evolutions: [
      { name: '발도', type: 1 },
      { name: '환영검무', type: 2 }
    ]
  }
  await render(async () => rankingOf(1), filter, onFilterChange, evolutionResponses())

  await vi.waitFor(() =>
    expect(evolutionButton('발도 명가의 손놀림').getAttribute('aria-pressed')).toBe('true')
  )
  expect(evolutionButton('발도 속전속결').getAttribute('aria-pressed')).toBe('false')
  expect(evolutionButton('환영검무 무형검무').getAttribute('aria-pressed')).toBe('true')
  expect(queries()).toEqual([{ ...GROW_FILTER, evolutions: '발도~1,환영검무~2' }])
  await act(async () => evolutionButton('발도 속전속결').click())
  expect(onFilterChange).toHaveBeenLastCalledWith({
    ...filter,
    evolutions: [
      { name: '환영검무', type: 2 },
      { name: '발도', type: 2 }
    ]
  })
  await act(async () => evolutionButton('환영검무 무형검무').click())
  expect(onFilterChange).toHaveBeenLastCalledWith({
    ...filter,
    evolutions: [{ name: '발도', type: 1 }]
  })
})

it('전직을 바꾸면 개화 선택을 지운 필터를 넘긴다', async () => {
  const onFilterChange = vi.fn()
  await render(
    async () => rankingOf(1),
    { ...GROW_FILTER, evolutions: [{ name: '발도', type: 1 }] },
    onFilterChange,
    evolutionResponses()
  )

  await act(async () => chip(WEAPON_MASTER.grows[1].name).click())

  expect(onFilterChange).toHaveBeenLastCalledWith({
    jobId: WEAPON_MASTER.jobId,
    jobGrowId: WEAPON_MASTER.grows[1].jobGrowId
  })
})

it('개화를 다섯 스킬에서 고르면 고르지 않은 스킬의 개화는 막는다', async () => {
  const names = ['가', '나', '다', '라', '마', '바']
  const evolutions = names.slice(0, 5).map((name) => ({ name, type: 1 as const }))
  await render(
    async () => rankingOf(1),
    { ...GROW_FILTER, evolutions },
    () => {},
    evolutionResponses(names)
  )

  await vi.waitFor(() => expect(evolutionButton('바 개화 Ⅰ')).not.toBeNull())
  expect(evolutionButton('바 개화 Ⅰ').disabled).toBe(true)
  expect(evolutionButton('가 개화 Ⅱ').disabled).toBe(false)
})

it('그 전직에 개화 스킬이 없으면 스킬 개화 줄을 두지 않는다', async () => {
  await render(
    async () => rankingOf(1),
    GROW_FILTER,
    () => {},
    evolutionResponses([])
  )
  await vi.waitFor(() => expect(container.querySelector('[aria-busy="true"]')).toBeNull())
  expect(rowLabels()).not.toContain('스킬 개화')
})

it('개화 스킬을 받지 못하면 문구와 다시 시도를 두고, 다시 시도하면 다시 받아 개화를 보인다', async () => {
  let skillStatsRequests = 0
  await render(
    async () => rankingOf(1),
    GROW_FILTER,
    () => {},
    {
      skillStats: http.get(SKILL_STATS_URL, () => {
        skillStatsRequests += 1

        if (skillStatsRequests > 1) {
          return HttpResponse.json(evolutionSkillStats(['발도']))
        }

        return HttpResponse.json(
          { error: { code: 'INTERNAL_SERVER_ERROR', message: '실패' } },
          { status: 500 }
        )
      }),
      skillWindow: skillWindowHandlers([storyWeaponMasterCatalog])
    }
  )

  await vi.waitFor(() =>
    expect(
      [...container.querySelectorAll('[role="alert"]')].map((alert) => alert.textContent)
    ).toContain('개화 스킬을 받지 못했습니다.')
  )
  await act(async () => chip('다시 시도').click())
  await vi.waitFor(() => expect(evolutionButton('발도 명가의 손놀림')).not.toBeNull())
})

function rangeInputs(): HTMLInputElement[] {
  return [...container.querySelectorAll<HTMLInputElement>('input[inputmode="numeric"]')]
}

it('검색 기준을 바꾸면 넣어 둔 범위를 비우고 그 기준으로 넘긴다', async () => {
  const onFilterChange = vi.fn()
  await render(
    async () => rankingOf(1),
    { jobId: WEAPON_MASTER.jobId, fameFrom: 136000 },
    onFilterChange
  )

  expect(setSelect('검색 기준').textContent).toContain('명성')
  await pickOption('검색 기준', '장비 점수')
  expect(onFilterChange).toHaveBeenLastCalledWith({
    jobId: WEAPON_MASTER.jobId,
    sort: 'equipmentScore',
    scoreFrom: undefined,
    scoreTo: undefined
  })

  await render(
    async () => rankingOf(1),
    { sort: 'equipmentScore', scoreFrom: 1300000 },
    onFilterChange
  )
  await pickOption('검색 기준', '명성')
  expect(onFilterChange).toHaveBeenLastCalledWith({ fameFrom: undefined, fameTo: undefined })
})

it('점수 기준이 든 필터로 들어오면 셀렉트와 입력에 그 값을 보이고, 적용하면 점수 범위로 넘기며 점수 헤더에 내림차순을 표시한다', async () => {
  const onFilterChange = vi.fn()
  await render(
    async () => rankingOf(1),
    { sort: 'equipmentScore', scoreFrom: 1300000, scoreTo: 1400000 },
    onFilterChange
  )

  expect(queries()).toEqual([{ sort: 'equipmentScore', scoreFrom: '1300000', scoreTo: '1400000' }])
  expect(setSelect('검색 기준').textContent).toContain('장비 점수')
  expect(rangeInputs().map((input) => [input.getAttribute('aria-label'), input.value])).toEqual([
    ['최저 장비 점수', '1,300,000'],
    ['최대 장비 점수', '1,400,000']
  ])
  expect(
    [...container.querySelectorAll('thead th[aria-sort="descending"]')].map(
      (cell) => cell.textContent
    )
  ).toEqual(['점수'])

  const [from] = rangeInputs()
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(from, '1350000')
    from!.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => chip('적용').click())

  expect(onFilterChange).toHaveBeenLastCalledWith({
    sort: 'equipmentScore',
    scoreFrom: 1350000,
    scoreTo: 1400000
  })
})

it('최저가 최대보다 크면 두 입력을 invalid로 두고 적용을 막는다', async () => {
  await render(async () => rankingOf(1), { sort: 'buffScore' })

  const [from, to] = rangeInputs()
  await act(async () => {
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setValue?.call(from, '240000')
    from!.dispatchEvent(new Event('input', { bubbles: true }))
    setValue?.call(to, '200000')
    to!.dispatchEvent(new Event('input', { bubbles: true }))
  })

  expect(chip('적용').disabled).toBe(true)
  expect(rangeInputs().map((input) => input.closest('[data-invalid]') !== null)).toEqual([
    true,
    true
  ])
})

it('범위 입력은 숫자만 남겨 세 자리마다 쉼표를 넣어 보이고, 적용하면 쉼표 없는 수로 넘긴다', async () => {
  const onFilterChange = vi.fn()
  await render(async () => rankingOf(1), {}, onFilterChange)

  const [from] = rangeInputs()
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
      from,
      '0a1,2b34'
    )
    from!.dispatchEvent(new Event('input', { bubbles: true }))
  })

  expect(rangeInputs()[0]!.value).toBe('1,234')
  await act(async () => chip('적용').click())
  expect(onFilterChange).toHaveBeenLastCalledWith({
    sort: undefined,
    fameFrom: 1234,
    fameTo: undefined,
    scoreFrom: undefined,
    scoreTo: undefined
  })
})

it('필터 줄은 직업, 고른 직업의 전직, 무기와 유일 장비를 한 줄에 둔 장비, 세트, 검색 기준 순이고, 직업을 고르지 않으면 전직 줄을 두지 않는다', async () => {
  await render(async () => rankingOf(1), {})

  const headingTexts = () =>
    [...container.querySelectorAll('h2')].map((heading) => heading.textContent)
  expect(headingTexts().slice(0, 4)).toEqual(['직업', '장비', '세트', '검색 기준'])

  await render(async () => rankingOf(1), { jobId: RANKING_JOBS[0].jobId })
  expect(headingTexts().slice(0, 5)).toEqual(['직업', '전직', '장비', '세트', '검색 기준'])

  const equipmentRow = [...container.querySelectorAll('[role="group"]')].find(
    (group) => group.querySelector('h2')?.textContent === '장비'
  )

  expect(
    [...(equipmentRow?.querySelectorAll('[role="combobox"]') ?? [])].map((select) =>
      select.getAttribute('aria-label')
    )
  ).toEqual(['무기', '유일 장비'])
})

it('점수 기준에서 세트를 고르면 기준과 점수 범위를 그대로 두고 세트만 바꿔 넘긴다', async () => {
  const onFilterChange = vi.fn()
  await render(
    async () => rankingOf(1),
    { sort: 'equipmentScore', scoreFrom: 1300000, equipmentSetId: FAIRY },
    onFilterChange,
    setResponses()
  )

  await pickOption('장비 세트', '황금향')

  expect(onFilterChange).toHaveBeenLastCalledWith({
    sort: 'equipmentScore',
    scoreFrom: 1300000,
    equipmentSetId: GOLDEN
  })
})

it('검색 기준만 점수로 바꾼 필터도 초기화로 지운다', async () => {
  const onFilterChange = vi.fn()
  await render(async () => rankingOf(1), { sort: 'buffScore' }, onFilterChange)

  expect(chip('초기화').disabled).toBe(false)
  await act(async () => chip('초기화').click())
  expect(onFilterChange).toHaveBeenLastCalledWith({})
})
