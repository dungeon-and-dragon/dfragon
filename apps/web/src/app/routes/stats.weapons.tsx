import { createFileRoute } from '@tanstack/react-router'
import { WeaponStatsPage } from '#pages/stats'
import { parseSetStatsSearch } from '#widgets/ranking-filter'
import { pageHead } from '#shared/lib/page-head'

export const Route = createFileRoute('/stats/weapons')({
  head: () => pageHead({ title: '무기 통계', path: '/stats/weapons' }),
  validateSearch: parseSetStatsSearch,
  component: WeaponStatsPage
})
