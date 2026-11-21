import { createFileRoute } from '@tanstack/react-router'
import { ComboStatsPage } from '#pages/stats'
import { parseSetStatsSearch } from '#widgets/ranking-filter'

export const Route = createFileRoute('/stats/combos')({
  validateSearch: parseSetStatsSearch,
  component: ComboStatsPage
})
