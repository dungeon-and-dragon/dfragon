import { createFileRoute } from '@tanstack/react-router'
import { prefetchOnServer } from '#app/prefetch-on-server'
import { setStatsQuery } from '#entities/ranking'
import { ComboStatsPage } from '#pages/stats'
import { parseSetStatsSearch } from '#widgets/ranking-filter'
import { pageHead } from '#shared/lib/page-head'

export const Route = createFileRoute('/stats/combos')({
  ssr: true,
  head: () => pageHead({ title: '조합 통계', path: '/stats/combos' }),
  validateSearch: parseSetStatsSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context: { queryClient }, deps }) =>
    prefetchOnServer(queryClient, setStatsQuery(deps)),
  component: ComboStatsPage
})
