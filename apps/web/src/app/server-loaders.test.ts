import { QueryClient } from '@tanstack/react-query'
import { isNotFound } from '@tanstack/react-router'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { server } from '#testing/test-support/msw-server'

// 브라우저 밖(node 환경)에서 route의 loader를 직접 불러, 서버가 화면을 그리기 전에 하는 일을 확인한다.
const API_ORIGIN = 'http://api.internal.test:3000'
const CHARACTER_URL = `${API_ORIGIN}/characters/prey/buffer-1`
const GUILD_URL = `${API_ORIGIN}/guilds/guild-1`

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

function requestedSearches(): string[] {
  return requested.map((url) => `${url.pathname}${url.search}`)
}

it('랭킹 loader는 주소의 필터로 첫 쪽을 서버에서 받아 캐시에 둔다', async () => {
  const { fameRankingHandlers } = await import('#entities/ranking/api/fame-ranking.handlers')
  const { fameRankingFixture } = await import('#entities/ranking/api/fame-ranking.fixture')
  const { fameRankingQuery } = await import('#entities/ranking')
  const { Route } = await import('./routes/rankings')
  const loader = Route.options.loader as Loader
  const { queryKey } = fameRankingQuery({ jobId: 'job-1', role: 'buffer' })

  server.use(fameRankingHandlers.pages)
  await loader({ context: { queryClient }, params: {}, deps: { jobId: 'job-1', role: 'buffer' } })

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
