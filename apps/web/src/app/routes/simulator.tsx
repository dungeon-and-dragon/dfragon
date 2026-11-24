import { createFileRoute } from '@tanstack/react-router'
import { parseCharacterSearch, SimulatorSearchPage } from '#pages/character-search'
import { pageHead } from '#shared/lib/page-head'

export const Route = createFileRoute('/simulator')({
  head: () => pageHead({ title: '장비 시뮬레이터', path: '/simulator', indexed: false }),
  validateSearch: parseCharacterSearch,
  component: SimulatorSearchPage
})
