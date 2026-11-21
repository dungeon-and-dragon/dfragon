import { createFileRoute } from '@tanstack/react-router'
import { StatsPage } from '#pages/stats'
import { pageHead } from '#shared/lib/page-head'

export const Route = createFileRoute('/stats/')({
  head: () => pageHead({ title: '통계', path: '/stats' }),
  component: StatsPage
})
