import { createFileRoute, redirect } from '@tanstack/react-router'
import { ClearsPage, contentAddressOf, parseClearSearch } from '#pages/clears'
import { pageHead } from '#shared/lib/page-head'

export const Route = createFileRoute('/clears/')({
  head: () => pageHead({ title: '클리어 통계', path: '/clears' }),
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
  },
  component: ClearsPage
})
