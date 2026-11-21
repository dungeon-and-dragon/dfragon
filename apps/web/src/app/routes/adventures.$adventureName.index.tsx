import { createFileRoute } from '@tanstack/react-router'
import { WeeklyPage, parseWeeklySearch } from '#pages/weekly'

export const Route = createFileRoute('/adventures/$adventureName/')({
  validateSearch: parseWeeklySearch,
  component: WeeklyPage
})
