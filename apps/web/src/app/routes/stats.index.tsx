import { createFileRoute } from '@tanstack/react-router'
import { StatsPage } from '#pages/stats'

export const Route = createFileRoute('/stats/')({
  component: StatsPage
})
