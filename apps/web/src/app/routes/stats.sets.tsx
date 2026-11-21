import { createFileRoute } from '@tanstack/react-router'
import { SetStatsPage } from '#pages/stats'
import { parseSetStatsSearch } from '#widgets/ranking-filter'

export const Route = createFileRoute('/stats/sets')({
  validateSearch: parseSetStatsSearch,
  component: SetStatsPage
})
