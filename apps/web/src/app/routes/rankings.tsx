import { createFileRoute } from '@tanstack/react-router'
import { RankingsPage } from '#pages/rankings'
import { parseRankingSearch } from '#widgets/ranking-filter'

export const Route = createFileRoute('/rankings')({
  validateSearch: parseRankingSearch,
  component: RankingsPage
})
