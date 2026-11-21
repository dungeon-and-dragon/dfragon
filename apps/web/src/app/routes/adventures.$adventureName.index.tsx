import { createFileRoute } from '@tanstack/react-router'
import { WeeklyPage, parseWeeklySearch } from '#pages/weekly'
import { pageHead } from '#shared/lib/page-head'

export const Route = createFileRoute('/adventures/$adventureName/')({
  head: ({ params: { adventureName } }) =>
    pageHead({
      title: '모험단',
      path: `/adventures/${encodeURIComponent(adventureName)}`,
      indexed: false
    }),
  validateSearch: parseWeeklySearch,
  component: WeeklyPage
})
