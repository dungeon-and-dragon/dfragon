import { createFileRoute } from '@tanstack/react-router'
import { SetStatsPage } from '#pages/stats'
import { parseSetStatsSearch } from '#widgets/ranking-filter'
import { pageHead } from '#shared/lib/page-head'

export const Route = createFileRoute('/stats/sets')({
  head: () => pageHead({ title: '세트 통계', path: '/stats/sets' }),
  validateSearch: parseSetStatsSearch,
  component: SetStatsPage
})
