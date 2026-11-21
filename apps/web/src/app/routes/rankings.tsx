import { createFileRoute } from '@tanstack/react-router'
import { RankingsPage } from '#pages/rankings'
import { parseRankingSearch } from '#widgets/ranking-filter'
import { pageHead } from '#shared/lib/page-head'

export const Route = createFileRoute('/rankings')({
  head: () => pageHead({ title: '검색', path: '/rankings' }),
  validateSearch: parseRankingSearch,
  component: RankingsPage
})
