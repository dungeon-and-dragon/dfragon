import { createFileRoute } from '@tanstack/react-router'
import { WeaponStatsPage } from '#pages/stats'
import { parseSetStatsSearch } from '#widgets/ranking-filter'

export const Route = createFileRoute('/stats/weapons')({
  validateSearch: parseSetStatsSearch,
  component: WeaponStatsPage
})
