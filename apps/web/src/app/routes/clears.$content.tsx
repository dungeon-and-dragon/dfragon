import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { prefetchOnServer } from '#app/prefetch-on-server'
import {
  ClearDetailPage,
  clearDetailOf,
  clearStatsQuery,
  contentAddressOf,
  isKnownContentId,
  parseClearDetailSearch
} from '#pages/clears'
import { pageHead } from '#shared/lib/page-head'

export const Route = createFileRoute('/clears/$content')({
  ssr: true,
  validateSearch: parseClearDetailSearch,
  // 컨텐츠 id로 연 상세 주소의 북마크가 깨지지 않게 그 컨텐츠의 묶음 주소로 넘긴다.
  beforeLoad: ({ params: { content }, search: { week } }) => {
    if (isKnownContentId(content)) {
      const { group, stage } = contentAddressOf(content)

      throw redirect({
        to: '/clears/$content',
        params: { content: group },
        search: { stage, week },
        replace: true
      })
    }
  },
  loaderDeps: ({ search: { stage, week } }) => ({ stage, week }),
  // 컨텐츠의 통계는 클리어 통계를 받아야 어느 컨텐츠와 주인지 알 수 있어 이어서 받는다.
  // 브라우저에서는 받기를 기다리지 않으므로 컨텐츠 이름은 캐시에 있을 때만 돌려준다.
  loader: async ({ context: { queryClient }, params: { content }, deps: { stage, week } }) => {
    await prefetchOnServer(queryClient, clearStatsQuery)
    const stats = queryClient.getQueryData(clearStatsQuery.queryKey)
    if (stats === undefined) {
      return { groupName: null }
    }

    const detail = clearDetailOf(stats, { contentKey: content, stage, week })
    if (detail === null) {
      if (typeof window === 'undefined') {
        throw notFound()
      }

      return { groupName: null }
    }

    if (detail.query !== null) {
      await prefetchOnServer(queryClient, detail.query)
    }

    return { groupName: detail.groupName }
  },
  head: ({ params: { content }, loaderData }) => {
    const groupName = loaderData?.groupName ?? null
    const title = groupName !== null ? `${groupName} 클리어 집계` : '클리어 집계'

    return pageHead({ title, path: `/clears/${encodeURIComponent(content)}` })
  },
  component: ClearDetailPage
})
