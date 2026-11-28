import { createFileRoute, redirect } from '@tanstack/react-router'
import { prefetchOnServer } from '#app/prefetch-on-server'
import {
  ClearsPage,
  clearOverviewQueryOf,
  clearStatsQuery,
  contentAddressOf,
  parseClearSearch
} from '#pages/clears'
import { pageHead } from '#shared/lib/page-head'

export const Route = createFileRoute('/clears/')({
  ssr: true,
  head: () => pageHead({ title: '클리어 집계', path: '/clears' }),
  validateSearch: parseClearSearch,
  // 컨텐츠를 고른 예전 주소의 북마크가 깨지지 않게 그 컨텐츠의 상세로 넘긴다.
  beforeLoad: ({ search: { content, week } }) => {
    if (content !== undefined) {
      const { group, stage } = contentAddressOf(content)

      throw redirect({
        to: '/clears/$content',
        params: { content: group },
        search: { stage, week },
        replace: true
      })
    }

    // 개요는 최신 주만 보이므로 예전 주를 고른 주소는 주를 뺀 주소로 넘긴다.
    if (week !== undefined) {
      throw redirect({ to: '/clears', search: {}, replace: true })
    }
  },
  // 최신 주의 개요는 클리어 통계를 받아야 어느 주인지 알 수 있어 이어서 받는다.
  loader: async ({ context: { queryClient } }) => {
    await prefetchOnServer(queryClient, clearStatsQuery)
    const stats = queryClient.getQueryData(clearStatsQuery.queryKey)
    const overviewQuery = stats !== undefined ? clearOverviewQueryOf(stats) : null

    if (overviewQuery !== null) {
      await prefetchOnServer(queryClient, overviewQuery)
    }
  },
  component: ClearsPage
})
