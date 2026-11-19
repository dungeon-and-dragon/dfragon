// @vitest-environment jsdom
import { HttpResponse, http } from 'msw'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { OathCatalog } from '#core/catalog'
import type {
  FameRanking,
  FameRankingFilter,
  ItemStats,
  RankedCharacter,
  SetStats
} from '#core/ranking'
import { FAME_RANKING_URL, fameRankingFailure } from '#entities/ranking/api/fame-ranking.handlers'
import { ClientHostContext, type ClientHost } from '#host/client-host'
import { createTestClientHost } from '#testing/test-support/client-host'
import { server } from '#testing/test-support/msw-server'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { TestRouter } from '#testing/test-support/test-router'
import { RankingsScreen } from './RankingsScreen'
import { RANKING_JOBS } from './ranking-jobs'

let container: HTMLDivElement
let root: Root
let observed: { callback: IntersectionObserverCallback; target: Element }[]
let requests: URLSearchParams[]

class FakeIntersectionObserver {
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe(target: Element): void {
    observed.push({ callback: this.callback, target })
  }
  disconnect(): void {
    observed = observed.filter((entry) => entry.callback !== this.callback)
  }
}

beforeEach(() => {
  observed = []
  requests = []
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

function rankedCharacter(rank: number, overrides: Partial<RankedCharacter> = {}): RankedCharacter {
  return {
    rank,
    serverId: 'cain',
    characterId: `character-${rank}`,
    characterName: `합성${rank}`,
    adventureName: `모험단${rank}`,
    level: 115,
    jobId: 'job-1',
    jobGrowId: 'grow-1',
    jobName: '합성 직업',
    jobGrowName: '眞 합성 전직',
    fame: 100000 - rank,
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

async function render(
  ranking: RankingResponse,
  filter: FameRankingFilter = {},
  onFilterChange: (filter: FameRankingFilter) => void = () => {},
  sets: Partial<Pick<ClientHost, 'getSetStats' | 'getOathCatalog' | 'getItemStats'>> = {}
): Promise<void> {
  respondRanking(ranking)
  await act(async () =>
    root.render(
      <ClientHostContext value={createTestClientHost(sets)}>
        <TestQueryClient>
          <TestRouter>
            <RankingsScreen filter={filter} onFilterChange={onFilterChange} />
          </TestRouter>
        </TestQueryClient>
      </ClientHostContext>
    )
  )
  await vi.waitFor(() => expect(container.textContent).not.toContain('랭킹을 받는 중입니다.'))
}

function bodyRows(): HTMLTableRowElement[] {
  return [...container.querySelectorAll<HTMLTableRowElement>('tbody tr:not([aria-hidden])')]
}

function reachEnd(): Promise<void> {
  return act(async () => {
    for (const { callback, target } of observed) {
      callback([{ isIntersecting: true, target } as IntersectionObserverEntry], {} as never)
    }
  })
}

function chip(label: string): HTMLButtonElement {
  return [...container.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) => button.textContent === label
  )!
}

it('받은 100명 가운데 처음 20명을 그리고 끝에 닿을 때마다 20명씩 더 그린다', async () => {
  await render(async () => rankingOf(100))

  expect(bodyRows()).toHaveLength(20)
  expect(container.querySelectorAll('tr[aria-hidden]')).toHaveLength(1)
  await reachEnd()
  expect(bodyRows()).toHaveLength(40)
  await reachEnd()
  await reachEnd()
  await reachEnd()
  expect(bodyRows()).toHaveLength(100)
  expect(container.querySelectorAll('tr[aria-hidden]')).toHaveLength(0)
})

it('열은 순위, 캐릭터, 세트, 명성, 모험단이고 세트 값을 받은 적 없는 행은 세트를 -로 그린다', async () => {
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
    '#',
    '캐릭터',
    '세트',
    '명성',
    '모험단'
  ])
  const [first, fourth] = bodyRows().map((row) =>
    [...row.querySelectorAll('td')].map((cell) => cell.textContent)
  )
  expect(first).toEqual([
    '1',
    '카인합성1합성 전직 합성 직업',
    '황금향용투 : 용제 강림',
    '99,999',
    '모험단1'
  ])
  expect(fourth).toEqual(['4', '카인합성4합성 직업', '-', '99,996', '모험단4'])
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
  expect(characterLines(maxLevel!)).toEqual(['카인합성1합성 전직 합성 직업', null])
  expect(characterLines(belowMax!)).toEqual(['카인합성2합성 전직 합성 직업Lv.110', null])
})

it('남성 크루세이더는 역할을 알면 역할을 붙이고 모든 전직 뒤에 직업명을 붙인다', async () => {
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
    '카인합성1크루세이더(딜러) 프리스트(남)',
    '카인합성2크루세이더(버퍼) 프리스트(남)',
    '카인합성3크루세이더 프리스트(남)',
    '카인합성4크루세이더 프리스트(여)',
    '카인합성5인파이터 프리스트(남)',
    '카인합성6넨마스터 격투가(여)'
  ])
})

it('빈 랭킹은 목록 상자에 빈 문구만 둔다', async () => {
  await render(async () => ({ characters: [], nextCursor: null }))

  expect(container.querySelector('section[aria-label="명성 랭킹"] p')?.textContent).toBe(
    '랭킹에 오른 캐릭터가 없습니다.'
  )
  expect(container.querySelector('table')).toBeNull()
})

it('고른 직업으로 목록 이름을 바꾸고, 앞의 眞을 뺀 전직 이름 칩으로 필터 변경을 알린다', async () => {
  const [job] = RANKING_JOBS
  const onFilterChange = vi.fn()
  await render(async () => rankingOf(1), { jobId: job.jobId }, onFilterChange)

  expect(container.querySelector(`section[aria-label="${job.name} 명성 랭킹"]`)).not.toBeNull()
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
  expect(container.querySelector('section[aria-label="제국기사 명성 랭킹"]')).not.toBeNull()
  await act(async () => chip('브레이커').click())
  expect(onFilterChange).toHaveBeenLastCalledWith({
    jobId,
    jobGrowId: '37495b941da3b1661bc900e68ef3b2c6'
  })
})

it('필터에 맞춰 직업, 전직을 넘겨 조회하고 실패하면 오류를 알린다', async () => {
  const [job] = RANKING_JOBS
  await render(() => fameRankingFailure('랭킹을 받지 못했습니다.'), {
    jobId: job.jobId,
    jobGrowId: job.grows[0].jobGrowId
  })

  expect(queries()).toEqual([{ jobId: job.jobId, jobGrowId: job.grows[0].jobGrowId }])
  expect(container.querySelector('[role="alert"]')?.textContent).toBe('랭킹을 받지 못했습니다.')
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
    container.querySelector('section[aria-label="프리스트(남) 크루세이더(딜러) 명성 랭킹"]')
  ).not.toBeNull()
  expect(chip('크루세이더(딜러)').hasAttribute('data-pressed')).toBe(true)
  expect(chip('크루세이더(버퍼)').hasAttribute('data-pressed')).toBe(false)
  expect(chip('전직 전체').hasAttribute('data-pressed')).toBe(false)
})

function rankingPage(from: number, count: number, nextCursor: string | null): FameRanking {
  const characters = Array.from({ length: count }, (_, index) => rankedCharacter(from + index))

  return { characters, nextCursor }
}

function rankTexts(): string[] {
  return bodyRows().map((row) => row.querySelector('td')?.textContent ?? '')
}

it('받은 행을 다 그리면 nextCursor로 다음 page를 받아 순위를 잇고, 마지막 page 뒤에는 더 받지 않는다', async () => {
  await render(async (cursor) => {
    if (cursor === null) {
      return rankingPage(1, 100, 'page-2')
    }

    return rankingPage(101, 30, null)
  })

  for (let step = 0; step < 5; step += 1) {
    await reachEnd()
  }
  await vi.waitFor(() => expect(container.querySelectorAll('tr[aria-hidden]')).toHaveLength(1))
  expect(queries()).toEqual([{}, { cursor: 'page-2' }])
  await reachEnd()
  await reachEnd()

  expect(rankTexts()).toHaveLength(130)
  expect(rankTexts().slice(99, 102)).toEqual(['100', '101', '102'])
  expect(container.querySelectorAll('tr[aria-hidden]')).toHaveLength(0)
  await reachEnd()
  expect(container.querySelectorAll('tr[aria-hidden]')).toHaveLength(0)
  expect(requests).toHaveLength(2)
})

it('다음 page를 받지 못하면 목록 끝에 오류와 다시 시도를 두고, 다시 시도하면 이어 받는다', async () => {
  let failNext = true
  await render(async (cursor) => {
    if (cursor === null) {
      return rankingPage(1, 20, 'page-2')
    }

    if (failNext) {
      failNext = false

      return fameRankingFailure('랭킹을 더 받지 못했습니다.')
    }

    return rankingPage(21, 5, null)
  })
  await reachEnd()

  await vi.waitFor(() =>
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      '랭킹을 더 받지 못했습니다.'
    )
  )
  expect(container.querySelectorAll('tr[aria-hidden]')).toHaveLength(0)
  await act(async () => chip('다시 시도').click())

  await vi.waitFor(() => expect(container.querySelector('[role="alert"]')).toBeNull())
  await reachEnd()
  expect(rankTexts()).toHaveLength(25)
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

const setHost = {
  getSetStats: async () => setStats,
  getOathCatalog: async () => oathCatalog
}

function setSelect(label: string): HTMLButtonElement {
  return container.querySelector<HTMLButtonElement>(`[role="combobox"][aria-label="${label}"]`)!
}

async function pickOption(label: string, optionText: string): Promise<void> {
  await act(async () => setSelect(label).click())
  const listbox = document.querySelector(`[role="listbox"][aria-label="${label}"]`)!
  const option = [...listbox.querySelectorAll<HTMLElement>('[role="option"]')].find(
    (item) => item.textContent === optionText
  )!
  await act(async () => option.click())
}

function optionTexts(label: string): string[] {
  const listbox = document.querySelector(`[role="listbox"][aria-label="${label}"]`)

  return [...(listbox?.querySelectorAll('[role="option"]') ?? [])].map(
    (item) => item.textContent ?? ''
  )
}

it('세트 셀렉트는 전체 직업 세트 통계에서 많이 낀 순으로 세트를 두고, 선택지는 카탈로그 순서로 줄여 쓴다', async () => {
  const getSetStats = vi.fn(setHost.getSetStats)
  await render(
    async () => rankingOf(1),
    { jobId: RANKING_JOBS[0].jobId, oathSetId: DRAGON },
    () => {},
    {
      ...setHost,
      getSetStats
    }
  )

  expect(getSetStats).toHaveBeenCalledWith({})
  await act(async () => setSelect('장비 세트').click())
  expect(optionTexts('장비 세트')).toEqual(['장비 세트 전체', '황금향', '페어리'])
  await act(async () => setSelect('서약 선택지').click())
  expect(optionTexts('서약 선택지')).toEqual([
    '선택지 전체',
    '용투 : 첫 번째',
    '용투 : 두 번째',
    '용투 : 세 번째'
  ])
})

it('세트를 고르면 직업 필터와 함께 넘기고, 서약 세트를 바꾸면 고른 선택지를 지운다', async () => {
  const onFilterChange = vi.fn()
  const jobId = RANKING_JOBS[0].jobId
  await render(
    async () => rankingOf(1),
    { jobId, oathSetId: DRAGON, oathSetOption: '용투 : 용제 강림' },
    onFilterChange,
    setHost
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
    setHost
  )

  expect(queries()).toEqual([{ ...filter, oathSetId: String(DRAGON) }])
  await vi.waitFor(() =>
    expect(
      container.querySelector('section[aria-label="황금향 용투 : 두 번째 명성 랭킹"]')
    ).not.toBeNull()
  )
  expect(setSelect('장비 세트').textContent).toContain('황금향')
  expect(setSelect('서약 선택지').textContent).toContain('용투 : 두 번째')
})

it('거른 랭킹이 비면 랭킹에 오른 캐릭터가 없다고 알린다', async () => {
  await render(
    async () => ({ characters: [], nextCursor: null }),
    { oathSetId: DRAGON },
    () => {},
    setHost
  )

  expect(container.querySelector('p.state')?.textContent).toBe('랭킹에 오른 캐릭터가 없습니다.')
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

function itemHost(stats: ItemStats) {
  return { getItemStats: async () => stats }
}

it('무기 셀렉트는 고른 직업, 전직의 아이템 통계에서 많이 낀 순이고, 유일 장비는 부위마다 착용 칩 하나다', async () => {
  const getItemStats = vi.fn(async () =>
    itemStatsOf([
      ['weapon-b', 1],
      ['weapon-a', 3]
    ])
  )
  const jobId = RANKING_JOBS[0].jobId
  await render(
    async () => rankingOf(1),
    { jobId },
    () => {},
    { getItemStats }
  )

  expect(getItemStats).toHaveBeenCalledWith({ jobId, jobGrowId: undefined, role: undefined })
  await act(async () => setSelect('무기').click())
  expect(optionTexts('무기')).toEqual(['무기 전체', '무기 weapon-a', '무기 weapon-b'])
  const uniqueRow = [...container.querySelectorAll('h2')].find(
    (heading) => heading.textContent === '유일 장비'
  )?.parentElement
  expect(
    [...(uniqueRow?.querySelectorAll('button') ?? [])].map((button) => button.textContent)
  ).toEqual(['반지 착용', '보조장비 착용'])
})

it('무기는 하나만 골라 바꾸고, 착용 칩은 그 부위 유일 장비 itemId를 넣고 뺀다', async () => {
  const onFilterChange = vi.fn()
  const host = itemHost(
    itemStatsOf([
      ['weapon-a', 3],
      ['weapon-b', 1]
    ])
  )
  await render(async () => rankingOf(1), { itemIds: ['ring-1', 'weapon-a'] }, onFilterChange, host)

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
  const host = itemHost(itemStatsOf([['weapon-a', 3]]))
  const jobId = RANKING_JOBS[0].jobId
  await render(
    async () => rankingOf(1),
    { jobId, itemIds: ['ring-1', 'other-job-weapon'] },
    onFilterChange,
    host
  )

  await vi.waitFor(() =>
    expect(onFilterChange).toHaveBeenLastCalledWith({ jobId, itemIds: ['ring-1'] })
  )
})

it('아이템 통계가 비어 있으면 주소의 아이템 필터를 지우지 않는다', async () => {
  const onFilterChange = vi.fn()
  const empty: ItemStats = { computedAt: null, sampleSize: 0, slots: [] }
  await render(async () => rankingOf(1), { itemIds: ['weapon-x'] }, onFilterChange, itemHost(empty))

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
    sampleSize: 20,
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
    itemHost(stats)
  )

  await act(async () => setSelect('무기').click())
  expect(weaponOptionGroups()).toEqual([
    [null, '무기 전체'],
    ['도', '도1', '도2'],
    ['낫', '낫1', '낫2'],
    [SEPARATOR],
    [null, '모름1']
  ])
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
    itemHost(stats)
  )

  await act(async () => setSelect('무기').click())
  expect(weaponOptionGroups()).toEqual([
    [null, '무기 전체'],
    [null, '도1'],
    [null, '낫1']
  ])
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
    itemHost(stats)
  )

  expect(setSelect('무기').textContent).toContain('gone-weapon')
  await act(async () => setSelect('무기').click())
  expect(weaponOptionGroups()).toEqual([
    [null, '무기 전체'],
    [null, 'gone-weapon'],
    ['도', '도1']
  ])
})
