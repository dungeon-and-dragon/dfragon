import { createFileRoute, redirect } from '@tanstack/react-router'
import { parseSetStatsSearch } from '#widgets/ranking-filter'

export const Route = createFileRoute('/stats/sets')({
  ssr: true,
  validateSearch: parseSetStatsSearch,
  beforeLoad: ({ search }) => {
    throw redirect({ to: '/stats/jobs', search, replace: true })
  }
})
