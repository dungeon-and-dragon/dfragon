import { createFileRoute } from '@tanstack/react-router'
import { ComboStatsPage } from '#pages/stats'
import { parseSetStatsSearch } from '#widgets/ranking-filter'
import { pageHead } from '#shared/lib/page-head'

export const Route = createFileRoute('/stats/combos')({
  head: () => pageHead({ title: '조합 통계', path: '/stats/combos' }),
  validateSearch: parseSetStatsSearch,
  component: ComboStatsPage
})
