import { createFileRoute } from '@tanstack/react-router'
import { fameRankingQuery } from '#entities/ranking'
import { RankingsPage } from '#pages/rankings'
import { parseRankingSearch, rankingFilterOf } from '#widgets/ranking-filter'
import { pageHead } from '#shared/lib/page-head'

export const Route = createFileRoute('/rankings')({
  ssr: true,
  head: () => pageHead({ title: '검색', path: '/rankings' }),
  validateSearch: parseRankingSearch,
  loaderDeps: ({ search }) => search,
  // 브라우저에서는 화면의 hook이 받으면서 받는 중 모양을 먼저 보이므로, 서버에서만 첫 쪽을 미리 받는다.
  loader: async ({ context: { queryClient }, deps }) => {
    if (typeof window === 'undefined') {
      const filter = rankingFilterOf(deps)
      await queryClient.prefetchInfiniteQuery(fameRankingQuery(filter))
    }
  },
  component: RankingsPage
})
