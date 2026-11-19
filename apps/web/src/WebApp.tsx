import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  redirect,
  RouterProvider
} from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useEffectEvent, useState } from 'react'
import { GlobalBar } from './components/GlobalBar'
import { SiteFooter } from './components/SiteFooter'
import { createQueryClient } from './lib/query-client'
import { ClientHostContext, type BrowserHost } from './host/client-host'
import { useScreenCaptureContext } from './hooks/useScreenCaptureContext'
import { useMyAdventureStore } from './hooks/useMyAdventureStore'
import { CharacterDetailPage, parseCharacterTabSearch } from '#pages/character'
import { CharacterSearchPage, parseCharacterSearch } from '#pages/character-search'
import { FavoritesPage } from '#pages/favorites'
import { GuildPage } from '#pages/guild'
import { HomePage } from '#pages/home'
import { PrivacyPage, TermsPage } from '#pages/legal'
import { NotFoundPage } from '#pages/not-found'
import { RankingsPage, parseJobSearch, parseRankingSearch } from '#pages/rankings'
import { MultisearchPage } from '#pages/multisearch'
import { SetStatsPage, StatsPage } from '#pages/stats'
import {
  ClearsPage,
  ClearDetailPage,
  contentAddressOf,
  isKnownContentId,
  parseClearDetailSearch,
  parseClearSearch
} from '#pages/clears'
import { AdventureEntryPage, WeeklyPage, parseWeeklySearch } from '#pages/weekly'
import { ScreenCaptureProvider } from './components/ScreenCaptureProvider'
import { WEB_CAPTURE_TEXTS } from '#core/capture'

// 다른 화면을 보는 동안 공유가 끝나도 연결 상태가 남지 않도록 화면 공유 칩 대신 라우터 위에서 구독한다.
function ScreenShareEndings({ host }: { host: BrowserHost }): null {
  const { selectSource } = useScreenCaptureContext().partyCapture.source
  const onShareEnded = useEffectEvent(() => selectSource(''))

  useEffect(() => host.onScreenShareEnded(onShareEnded), [host])

  return null
}

function SiteLayout(): React.JSX.Element {
  return (
    <div className="flex grow flex-col overflow-x-clip font-sans text-fg">
      <GlobalBar />
      {/* 600px 미만에서는 페이지 대신 화면 상자 안에서 가로로 스크롤한다. 안의 보조 기술용 absolute 요소가 상자 밖 페이지를
          기준으로 놓이면 overflow에 잘리지 않고 페이지를 넓히므로 상자를 기준으로 삼는다. 넓은 창에서는 구획의 가로 선이
          상자 밖 창 끝까지 그어져야 하므로 상자에 스크롤을 두지 않는다. */}
      <div className="page screen bg-canvas">
        <main className="relative flex flex-col max-sm:overflow-x-auto">
          <Outlet />
        </main>
        <SiteFooter />
      </div>
    </div>
  )
}

const rootRoute = createRootRouteWithContext<{ host: BrowserHost }>()({
  component: SiteLayout,
  notFoundComponent: NotFoundPage
})

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage
})

const multisearchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/multisearch',
  component: MultisearchPage
})

const characterRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/c/$serverId/$characterId',
  validateSearch: parseCharacterTabSearch,
  component: CharacterDetailPage
})

const characterSearchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/search',
  validateSearch: parseCharacterSearch,
  component: CharacterSearchPage
})

const rankingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/rankings',
  validateSearch: parseRankingSearch,
  component: RankingsPage
})

const statsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/stats',
  component: StatsPage
})

const setStatsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/stats/sets',
  validateSearch: parseJobSearch,
  component: SetStatsPage
})

const clearsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/clears',
  validateSearch: parseClearSearch,
  // 컨텐츠를 고른 예전 주소의 북마크가 깨지지 않게 그 컨텐츠의 상세로 넘긴다.
  beforeLoad: ({ search: { content, week } }) => {
    if (content !== undefined) {
      const { group, stage } = contentAddressOf(content)
      throw redirect({
        to: '/clears/$content',
        params: { content: group },
        search: { stage, week },
        replace: true
      })
    }
  },
  component: ClearsPage
})

const clearContentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/clears/$content',
  validateSearch: parseClearDetailSearch,
  // 컨텐츠 id로 연 상세 주소의 북마크가 깨지지 않게 그 컨텐츠의 묶음 주소로 넘긴다.
  beforeLoad: ({ params: { content }, search: { week } }) => {
    if (isKnownContentId(content)) {
      const { group, stage } = contentAddressOf(content)
      throw redirect({
        to: '/clears/$content',
        params: { content: group },
        search: { stage, week },
        replace: true
      })
    }
  },
  component: ClearDetailPage
})

const adventureEntryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/adventures',
  validateSearch: parseWeeklySearch,
  beforeLoad: ({ search }) => {
    const { adventureName } = useMyAdventureStore.getState()
    if (adventureName != null) {
      throw redirect({
        to: '/adventures/$adventureName',
        params: { adventureName },
        search,
        replace: true
      })
    }
  },
  component: AdventureEntryPage
})

const adventureRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/adventures/$adventureName',
  validateSearch: parseWeeklySearch,
  component: WeeklyPage
})

const guildRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/guilds/$guildId',
  component: GuildPage
})

// 예전 내 모험단 주소의 북마크가 깨지지 않게 모험단 화면으로 넘긴다.
const legacyMyAdventureRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/my',
  validateSearch: parseWeeklySearch,
  beforeLoad: ({ search }) => {
    throw redirect({ to: '/adventures', search, replace: true })
  }
})

const favoritesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/favorites',
  component: FavoritesPage
})

const termsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/terms',
  component: TermsPage
})

const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/privacy',
  component: PrivacyPage
})

const routeTree = rootRoute.addChildren([
  homeRoute,
  multisearchRoute,
  characterRoute,
  characterSearchRoute,
  rankingsRoute,
  statsRoute,
  setStatsRoute,
  clearsRoute,
  clearContentRoute,
  adventureEntryRoute,
  adventureRoute,
  guildRoute,
  legacyMyAdventureRoute,
  favoritesRoute,
  termsRoute,
  privacyRoute
])

function createWebRouter(host: BrowserHost) {
  return createRouter({ routeTree, context: { host } })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createWebRouter>
  }
}

// 화면을 옮겨도 화면 공유 연결과 표 상태가 남도록 host와 캡처 provider를 라우터 위에 둔다.
export function WebApp({ host }: { host: BrowserHost }): React.JSX.Element {
  const [router] = useState(() => createWebRouter(host))
  const [queryClient] = useState(createQueryClient)

  return (
    <ClientHostContext value={host}>
      <QueryClientProvider client={queryClient}>
        <ScreenCaptureProvider texts={WEB_CAPTURE_TEXTS}>
          <ScreenShareEndings host={host} />
          <RouterProvider router={router} />
        </ScreenCaptureProvider>
      </QueryClientProvider>
    </ClientHostContext>
  )
}
