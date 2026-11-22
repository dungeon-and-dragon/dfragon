import { createFileRoute } from '@tanstack/react-router'
import { prefetchOnServer } from '#app/prefetch-on-server'
import { itemStatsQuery, setStatsQuery } from '#entities/ranking'
import { SetStatsPage } from '#pages/stats'
import { parseSetStatsSearch } from '#widgets/ranking-filter'
import { pageHead } from '#shared/lib/page-head'

export const Route = createFileRoute('/stats/sets')({
  ssr: true,
  head: () => pageHead({ title: '세트 통계', path: '/stats/sets' }),
  validateSearch: parseSetStatsSearch,
  loaderDeps: ({ search }) => search,
  // 세트 상자는 브라우저만 받을 수 있는 서약 데이터를 기다리므로 서버 HTML에는 무기, 유일 장비 상자만 들어간다.
  loader: async ({ context: { queryClient }, deps }) => {
    const setStats = setStatsQuery(deps)
    const itemStats = itemStatsQuery(deps)

    await Promise.all([
      prefetchOnServer(queryClient, setStats),
      prefetchOnServer(queryClient, itemStats)
    ])
  },
  component: SetStatsPage
})
