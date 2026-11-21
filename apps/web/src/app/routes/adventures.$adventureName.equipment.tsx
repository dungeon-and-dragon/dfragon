import { createFileRoute } from '@tanstack/react-router'
import { AdventureEquipmentPage, parseEquipmentSearch } from '#pages/weekly'

export const Route = createFileRoute('/adventures/$adventureName/equipment')({
  validateSearch: parseEquipmentSearch,
  component: AdventureEquipmentPage
})
