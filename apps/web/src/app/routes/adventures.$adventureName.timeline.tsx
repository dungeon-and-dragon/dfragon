import { createFileRoute } from '@tanstack/react-router'
import { AdventureTimelinePage, parseTimelineSearch } from '#pages/weekly'
import { pageHead } from '#shared/lib/page-head'

export const Route = createFileRoute('/adventures/$adventureName/timeline')({
  head: ({ params: { adventureName } }) =>
    pageHead({
      title: '모험단 타임라인',
      path: `/adventures/${encodeURIComponent(adventureName)}/timeline`,
      indexed: false
    }),
  validateSearch: parseTimelineSearch,
  component: AdventureTimelinePage
})
