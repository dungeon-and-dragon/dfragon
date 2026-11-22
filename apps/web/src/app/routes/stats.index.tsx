import { createFileRoute } from '@tanstack/react-router'
import { prefetchOnServer } from '#app/prefetch-on-server'
import { characterStatsQuery, StatsPage } from '#pages/stats'
import { pageHead } from '#shared/lib/page-head'

export const Route = createFileRoute('/stats/')({
  ssr: true,
  head: () => pageHead({ title: '통계', path: '/stats' }),
  loader: ({ context: { queryClient } }) => prefetchOnServer(queryClient, characterStatsQuery),
  component: StatsPage
})
