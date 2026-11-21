import { createFileRoute, redirect } from '@tanstack/react-router'
import { useMyAdventureStore } from '#entities/adventure-guild'
import { AdventureEntryPage, parseWeeklySearch } from '#pages/weekly'

export const Route = createFileRoute('/adventures/')({
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
