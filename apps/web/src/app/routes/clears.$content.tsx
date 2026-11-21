import { createFileRoute, redirect } from '@tanstack/react-router'
import {
  ClearDetailPage,
  contentAddressOf,
  isKnownContentId,
  parseClearDetailSearch
} from '#pages/clears'
import { pageHead } from '#shared/lib/page-head'

export const Route = createFileRoute('/clears/$content')({
  head: ({ params: { content } }) =>
    pageHead({ title: '클리어 집계', path: `/clears/${encodeURIComponent(content)}` }),
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
  component: ClearDetailPage
})
