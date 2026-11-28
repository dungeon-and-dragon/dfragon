import { createFileRoute } from '@tanstack/react-router'
import { prefetchOnServer } from '#app/prefetch-on-server'
import { itemStatsQuery, setStatsQuery, skillStatsQuery } from '#entities/ranking'
import { JobStatsPage, jobStatsFilterOf, skillStatsGrowOf } from '#pages/stats'
import { parseSetStatsSearch } from '#widgets/ranking-filter'
import { pageHead } from '#shared/lib/page-head'

export const Route = createFileRoute('/stats/jobs')({
  ssr: true,
  head: () => pageHead({ title: '직업 통계', path: '/stats/jobs' }),
  validateSearch: parseSetStatsSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ context: { queryClient }, deps }) => {
    const { statsJob } = skillStatsGrowOf(deps)
    const filter = jobStatsFilterOf(deps)
    const skillStats = skillStatsQuery(statsJob)
    const setStats = setStatsQuery(filter)
    const itemStats = itemStatsQuery(filter)

    await Promise.all([
      prefetchOnServer(queryClient, skillStats),
      prefetchOnServer(queryClient, setStats),
      prefetchOnServer(queryClient, itemStats)
    ])
  },
  component: JobStatsPage
})
