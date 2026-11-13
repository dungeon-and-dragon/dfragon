import * as stylex from '@stylexjs/stylex'
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  redirect,
  RouterProvider,
  useMatch
} from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useEffectEvent, useState } from 'react'
import { GlobalBar } from './components/GlobalBar'
import { SiteFooter } from './components/SiteFooter'
import { CONTENT_WIDTH } from './constants/layout'
import { createQueryClient } from './lib/query-client'
import { ClientHostContext, type BrowserHost } from './host/client-host'
import { useScreenCaptureContext } from './hooks/useScreenCaptureContext'
import { useMyAdventureStore } from './hooks/useMyAdventureStore'
import { parseCharacterTabSearch } from './pages/character/character-tabs'
import { parseCharacterSearch } from './pages/character-search/character-search-params'
import { CharacterSearchPage } from './pages/character-search/CharacterSearchPage'
import { CharacterDetailPage } from './pages/character/CharacterDetailPage'
import { FavoritesPage } from './pages/favorites/FavoritesPage'
import { GuildPage } from './pages/guild/GuildPage'
import { HomePage } from './pages/home/HomePage'
import { PrivacyPage, TermsPage } from './pages/legal/LegalPage'
import { NotFoundPage } from './pages/not-found/NotFoundPage'
import { parseRankingSearch } from './pages/rankings/ranking-search'
import { RankingsPage } from './pages/rankings/RankingsPage'
import { MultisearchPage } from './pages/multisearch/MultisearchPage'
import { StatsPage } from './pages/stats/StatsPage'
import { ClearsPage } from './pages/clears/ClearsPage'
import { ClearContentPage } from './pages/clears/ClearContentPage'
import { parseClearSearch, parseClearWeekSearch } from './pages/clears/clear-search'
import { parseWeeklySearch } from './pages/weekly/weekly-search'
import { AdventureEntryPage, WeeklyPage } from './pages/weekly/WeeklyPage'
import { ScreenCaptureProvider } from './components/ScreenCaptureProvider'
import { styles } from './WebApp.style'
import { WEB_CAPTURE_TEXTS } from '#core/capture/capture-texts'

// 다른 화면을 보는 동안 공유가 끝나도 연결 상태가 남지 않도록 화면 공유 칩 대신 라우터 위에서 구독한다.
function ScreenShareEndings({ host }: { host: BrowserHost }): null {
  const { selectSource } = useScreenCaptureContext().partyCapture.source
  const onShareEnded = useEffectEvent(() => selectSource(''))

  useEffect(() => host.onScreenShareEnded(onShareEnded), [host])

  return null
}

function SiteLayout(): React.JSX.Element {
  const adventure = useMatch({ from: adventureRoute.id, shouldThrow: false })

  return (
    <div {...stylex.props(styles.site)}>
      <GlobalBar />
      <main
        {...stylex.props(
          styles.screen,
          adventure !== undefined && styles.sideRoomScreen,
          styles.screenWidth(CONTENT_WIDTH)
        )}
      >
        <Outlet />
      </main>
      <SiteFooter />
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

const clearsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/clears',
  validateSearch: parseClearSearch,
  // 컨텐츠를 고른 예전 주소의 북마크가 깨지지 않게 그 컨텐츠의 상세로 넘긴다.
  beforeLoad: ({ search: { content, week } }) => {
    if (content !== undefined) {
      throw redirect({
        to: '/clears/$contentId',
        params: { contentId: content },
        search: { week },
        replace: true
      })
    }
  },
  component: ClearsPage
})

const clearContentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/clears/$contentId',
  validateSearch: parseClearWeekSearch,
  component: ClearContentPage
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
