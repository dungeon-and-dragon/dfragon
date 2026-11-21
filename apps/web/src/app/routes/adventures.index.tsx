import { createFileRoute, redirect } from '@tanstack/react-router'
import { useMyAdventureStore } from '#entities/adventure-guild'
import { AdventureEntryPage, parseWeeklySearch } from '#pages/weekly'
import { pageHead } from '#shared/lib/page-head'

export const Route = createFileRoute('/adventures/')({
  head: () => pageHead({ title: '모험단', path: '/adventures', indexed: false }),
  validateSearch: parseWeeklySearch,
  beforeLoad: ({ search }) => {
    const { adventureName } = useMyAdventureStore.getState()
    if (adventureName != null) {
      throw redirect({
        to: '/adventures/$adventureName',
        params: { adventureName },
        search,
        replace: true
      })
    }
  },
  component: AdventureEntryPage
})
