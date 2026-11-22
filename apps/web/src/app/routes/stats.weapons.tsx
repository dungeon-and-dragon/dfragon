import { createFileRoute } from '@tanstack/react-router'
import { prefetchOnServer } from '#app/prefetch-on-server'
import { itemStatsQuery } from '#entities/ranking'
import { WeaponStatsPage } from '#pages/stats'
import { parseSetStatsSearch } from '#widgets/ranking-filter'
import { pageHead } from '#shared/lib/page-head'

export const Route = createFileRoute('/stats/weapons')({
  ssr: true,
  head: () => pageHead({ title: '무기 통계', path: '/stats/weapons' }),
  validateSearch: parseSetStatsSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context: { queryClient }, deps }) =>
    prefetchOnServer(queryClient, itemStatsQuery(deps)),
  component: WeaponStatsPage
})
