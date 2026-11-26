import { QueryClient } from '@tanstack/react-query'
import { isNotFound } from '@tanstack/react-router'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { server } from '#testing/test-support/msw-server'

// 브라우저 밖(node 환경)에서 route의 loader를 직접 불러, 서버가 화면을 그리기 전에 하는 일을 확인한다.
const API_ORIGIN = 'http://api.internal.test:3000'
const CHARACTER_URL = `${API_ORIGIN}/characters/prey/buffer-1`
const GUILD_URL = `${API_ORIGIN}/guilds/guild-1`
const LAB_ITEMS_URL = `${API_ORIGIN}/lab/items`

type Loader = (match: {
  context: { queryClient: QueryClient }
  params: Record<string, string>
  deps: Record<string, unknown>
}) => Promise<unknown>

let queryClient: QueryClient
let requested: URL[]

function recordRequest({ request }: { request: Request }): void {
  requested.push(new URL(request.url))
}

beforeEach(() => {
  vi.stubEnv('DFRAGON_API_ORIGIN', API_ORIGIN)
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  requested = []
  server.events.on('request:start', recordRequest)
})

afterEach(() => {
  server.events.removeListener('request:start', recordRequest)
  queryClient.clear()
  vi.unstubAllEnvs()
  vi.resetModules()
})

async function loadCharacter(): Promise<unknown> {
  const { Route } = await import('./routes/c.$serverId.$characterId')
  const loader = Route.options.loader as Loader

  return loader({
    context: { queryClient },
    params: { serverId: 'prey', characterId: 'buffer-1' },
    deps: {}
  })
}

async function loadGuild(): Promise<unknown> {
  const { Route } = await import('./routes/guilds.$guildId')
  const loader = Route.options.loader as Loader

  return loader({ context: { queryClient }, params: { guildId: 'guild-1' }, deps: {} })
}

it('캐릭터 loader는 서버에서 상세를 받아 캐시에 두고 제목에 쓸 이름을 돌려준다', async () => {
  server.use(
    http.get(CHARACTER_URL, () =>
      HttpResponse.json({
        character: { serverId: 'prey', characterId: 'buffer-1', characterName: '하늘', fame: 1 },
        freshness: { lastSuccessfulFetchAt: '2026-11-09T05:08:00.000Z' },
        card: null
      })
    )
  )

  await expect(loadCharacter()).resolves.toEqual({ characterName: '하늘' })
  expect(queryClient.getQueryData(['character', 'prey', 'buffer-1', 'detail'])).toMatchObject({
    character: { characterName: '하늘' }
  })
})

it('캐릭터 loader는 API가 없는 캐릭터라고 답하면 없는 주소로 처리한다', async () => {
  server.use(
    http.get(CHARACTER_URL, () =>
      HttpResponse.json(
        { error: { code: 'CHARACTER_NOT_FOUND', message: '캐릭터를 찾을 수 없습니다.' } },
        { status: 404 }
      )
    )
  )

  const failure = await loadCharacter().catch((error: unknown) => error)

  expect(isNotFound(failure)).toBe(true)
})

it('캐릭터 loader는 그 밖의 실패에는 이름 없이 끝나 화면을 그리게 둔다', async () => {
  server.use(
    http.get(CHARACTER_URL, () =>
      HttpResponse.json(
        { error: { code: 'INTERNAL_SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      )
    )
  )

  await expect(loadCharacter()).resolves.toEqual({ characterName: null })
})

it('길드 loader는 서버에서 길드를 받아 캐시에 두고 제목에 쓸 이름을 돌려준다', async () => {
  server.use(
    http.get(GUILD_URL, () =>
      HttpResponse.json({ guildId: 'guild-1', guildName: '길드1', memberCount: 0, members: [] })
    )
  )

  await expect(loadGuild()).resolves.toEqual({ guildName: '길드1' })
  expect(queryClient.getQueryData(['guild', 'guild-1'])).toMatchObject({ guildName: '길드1' })
})

it('길드 loader는 받지 못하면 이름 없이 끝나 화면을 그리게 둔다', async () => {
  server.use(http.get(GUILD_URL, () => HttpResponse.error()))

  await expect(loadGuild()).resolves.toEqual({ guildName: null })
})

it('실험실 loader가 서버에서 받아 둔 재화와 아이템 아이콘 주소는 내부 API 주소가 아니라 같은 origin의 /api 경로다', async () => {
  const iconPath = '/lab/currencies/1/icon?v=1'
  server.use(
    http.get(LAB_ITEMS_URL, () =>
      HttpResponse.json({
        groups: [
          {
            category: 'WEAPON',
            role: 'dealer',
            tier: '준종결',
            items: [
              {
                itemName: '합성 보주',
                itemId: null,
                itemRarity: null,
                iconPath: '/lab/item-icon?itemName=x&v=1',
                description: null,
                unitPrice: null,
                checkedAt: null,
                cost: { currencyName: '합성 주화', description: null, count: 5, iconPath }
              }
            ]
          }
        ]
      })
    )
  )
  const { Route } = await import('./routes/lab.enchants')
  const { labItemsQuery } = await import('#pages/lab')
  const loader = Route.options.loader as Loader

  await loader({ context: { queryClient }, params: {}, deps: {} })

  const cached = queryClient.getQueryData(labItemsQuery.queryKey)
  expect(cached).toMatchObject({
    groups: [
      {
        items: [
          { iconUrl: '/api/lab/item-icon?itemName=x&v=1', cost: { iconUrl: `/api${iconPath}` } }
        ]
      }
    ]
  })
  expect(JSON.stringify(cached)).not.toContain(API_ORIGIN)
})

function requestedSearches(): string[] {
  return requested.map((url) => `${url.pathname}${url.search}`)
}

it('랭킹 loader는 주소의 필터로 첫 쪽을 서버에서 받아 캐시에 두고 구조화 데이터에 쓸 캐릭터를 돌려준다', async () => {
  const { fameRankingHandlers } = await import('#entities/ranking/api/fame-ranking.handlers')
  const { fameRankingFixture } = await import('#entities/ranking/api/fame-ranking.fixture')
  const { fameRankingQuery } = await import('#entities/ranking')
  const { Route } = await import('./routes/rankings')
  const loader = Route.options.loader as Loader
  const { queryKey } = fameRankingQuery({ jobId: 'job-1', role: 'buffer' })

  const expectedCharacters = fameRankingFixture.firstPage.characters
    .slice(0, 20)
    .map(({ serverId, characterId, characterName }) => ({ serverId, characterId, characterName }))

  server.use(fameRankingHandlers.pages)

  await expect(
    loader({ context: { queryClient }, params: {}, deps: { jobId: 'job-1', role: 'buffer' } })
  ).resolves.toEqual({ characters: expectedCharacters })
  expect(fameRankingFixture.firstPage.characters.length).toBeGreaterThan(20)
  expect(requestedSearches()).toEqual(['/rankings/fame?jobId=job-1&role=buffer'])
  expect(queryClient.getQueryData(queryKey)?.pages).toEqual([fameRankingFixture.firstPage])
})

it('통계 loader는 캐릭터 통계를 서버에서 받아 캐시에 둔다', async () => {
  const { characterStatsHandlers } = await import('#pages/stats/api/stats.handlers')
  const { Route } = await import('./routes/stats.index')
  const loader = Route.options.loader as Loader

  server.use(characterStatsHandlers.stats)
  await loader({ context: { queryClient }, params: {}, deps: {} })

  expect(requestedSearches()).toEqual(['/stats'])
  expect(queryClient.getQueryData(['stats'])).toBeDefined()
})

it('세트 통계 loader는 주소의 직업으로 세트 통계와 아이템 통계를 함께 받는다', async () => {
  const { setStatsHandlers } = await import('#entities/ranking/api/set-stats.handlers')
  const { itemStatsHandlers } = await import('#entities/ranking/api/item-stats.handlers')
  const { itemStatsQuery, setStatsQuery } = await import('#entities/ranking')
  const { Route } = await import('./routes/stats.sets')
  const loader = Route.options.loader as Loader
  const filter = { jobId: 'job-1' }
  const setStatsKey = setStatsQuery(filter).queryKey
  const itemStatsKey = itemStatsQuery(filter).queryKey

  server.use(setStatsHandlers.empty, itemStatsHandlers.empty)
  await loader({ context: { queryClient }, params: {}, deps: filter })

  expect(requestedSearches().toSorted()).toEqual([
    '/stats/items?jobId=job-1&sample=all',
    '/stats/sets?jobId=job-1&sample=all'
  ])
  expect(queryClient.getQueryData(setStatsKey)).toBeDefined()
  expect(queryClient.getQueryData(itemStatsKey)).toBeDefined()
})

it('조합 통계 loader는 세트 통계를, 무기 통계 loader는 아이템 통계를 주소의 직업으로 받는다', async () => {
  const { setStatsHandlers } = await import('#entities/ranking/api/set-stats.handlers')
  const { itemStatsHandlers } = await import('#entities/ranking/api/item-stats.handlers')
  const combos = await import('./routes/stats.combos')
  const weapons = await import('./routes/stats.weapons')

  server.use(setStatsHandlers.empty, itemStatsHandlers.empty)

  await (combos.Route.options.loader as Loader)({
    context: { queryClient },
    params: {},
    deps: { jobId: 'job-1' }
  })
  await (weapons.Route.options.loader as Loader)({
    context: { queryClient },
    params: {},
    deps: { jobId: 'job-2', sample: 'top' }
  })

  expect(requestedSearches()).toEqual([
    '/stats/sets?jobId=job-1&sample=all',
    '/stats/items?jobId=job-2&sample=top'
  ])
})

it('스킬 통계 loader는 주소의 전직으로, 주소에 직업이 없으면 귀검사(남) 웨펀마스터로 스킬 통계를 받아 캐시에 둔다', async () => {
  const { skillStatsHandlers } = await import('#entities/ranking/api/skill-stats.handlers')
  const { skillStatsFixture } = await import('#pages/stats/api/skill-stats.fixture')
  const { RANKING_JOBS } = await import('#entities/character')
  const { skillStatsQuery } = await import('#entities/ranking')
  const { Route } = await import('./routes/stats.skills')
  const loader = Route.options.loader as Loader
  const job = RANKING_JOBS.find(({ name }) => name === '귀검사(남)')!
  const [weaponMaster, soulBringer] = job.grows
  const { queryKey } = skillStatsQuery({
    jobId: job.jobId,
    jobGrowId: weaponMaster!.jobGrowId,
    role: null
  })

  server.use(skillStatsHandlers.of(skillStatsFixture))
  await loader({ context: { queryClient }, params: {}, deps: {} })
  await loader({
    context: { queryClient },
    params: {},
    deps: { jobId: job.jobId, jobGrowId: soulBringer!.jobGrowId }
  })

  expect(requestedSearches()).toEqual([
    `/stats/skills?jobId=${job.jobId}&jobGrowId=${weaponMaster!.jobGrowId}`,
    `/stats/skills?jobId=${job.jobId}&jobGrowId=${soulBringer!.jobGrowId}`
  ])
  expect(queryClient.getQueryData(queryKey)).toBeDefined()
})

async function loadClearDetail(content: string, deps: Record<string, unknown>): Promise<unknown> {
  const { clearStatsHandlers } = await import('#pages/clears/api/clears.handlers')
  const { Route } = await import('./routes/clears.$content')
  const loader = Route.options.loader as Loader

  server.use(...clearStatsHandlers.stats)

  return loader({ context: { queryClient }, params: { content }, deps })
}

it('클리어 개요 loader는 클리어 통계를 받은 뒤 가장 최근 주의 개요를 이어서 받는다', async () => {
  const { clearStatsHandlers } = await import('#pages/clears/api/clears.handlers')
  const { Route } = await import('./routes/clears.index')
  const loader = Route.options.loader as Loader

  server.use(...clearStatsHandlers.stats)
  await loader({ context: { queryClient }, params: {}, deps: {} })

  expect(requestedSearches()).toEqual(['/stats/clears', '/stats/clears/overview?week=2026-11-12'])
})

it('클리어 상세 loader는 주소의 컨텐츠 묶음과 단계로 컨텐츠 통계를 이어서 받고 묶음 이름을 돌려준다', async () => {
  await expect(loadClearDetail('michaela', { stage: 'normal' })).resolves.toEqual({
    groupName: '무너진 성자 미카엘라'
  })
  expect(requestedSearches()).toEqual([
    '/stats/clears',
    '/stats/clears/michaela-normal?week=2026-11-12'
  ])
})

it('클리어 상세 loader는 클리어 통계에 없는 컨텐츠 묶음을 없는 주소로 처리한다', async () => {
  const failure = await loadClearDetail('no-such-content', {}).catch((error: unknown) => error)

  expect(isNotFound(failure)).toBe(true)
  expect(requestedSearches()).toEqual(['/stats/clears'])
})

it('클리어 상세 loader는 클리어 통계를 받지 못하면 이름 없이 끝나 화면을 그리게 둔다', async () => {
  const { CLEAR_STATS_URL } = await import('#pages/clears/api/clears.handlers')
  const { Route } = await import('./routes/clears.$content')
  const loader = Route.options.loader as Loader

  server.use(http.get(CLEAR_STATS_URL, () => HttpResponse.error()))

  await expect(
    loader({ context: { queryClient }, params: { content: 'michaela' }, deps: {} })
  ).resolves.toEqual({ groupName: null })
})
