import { createFileRoute } from '@tanstack/react-router'
import { prefetchOnServer } from '#app/prefetch-on-server'
import { skillStatsQuery } from '#entities/ranking'
import { SkillStatsPage, skillStatsGrowOf } from '#pages/stats'
import { parseJobSearch } from '#widgets/ranking-filter'
import { pageHead } from '#shared/lib/page-head'

export const Route = createFileRoute('/stats/skills')({
  ssr: true,
  head: () => pageHead({ title: '스킬 통계', path: '/stats/skills' }),
  validateSearch: parseJobSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context: { queryClient }, deps }) => {
    const { statsJob } = skillStatsGrowOf(deps)

    return prefetchOnServer(queryClient, skillStatsQuery(statsJob))
  },
  component: SkillStatsPage
})
