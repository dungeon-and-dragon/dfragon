import { createFileRoute } from '@tanstack/react-router'
import { AdventureEquipmentPage, parseEquipmentSearch } from '#pages/weekly'
import { pageHead } from '#shared/lib/page-head'

export const Route = createFileRoute('/adventures/$adventureName/equipment')({
  head: ({ params: { adventureName } }) =>
    pageHead({
      title: '모험단 장비',
      path: `/adventures/${encodeURIComponent(adventureName)}/equipment`,
      indexed: false
    }),
  validateSearch: parseEquipmentSearch,
  component: AdventureEquipmentPage
})
