import { createFileRoute } from '@tanstack/react-router'
import { CharacterSearchPage, parseCharacterSearch } from '#pages/character-search'

export const Route = createFileRoute('/search')({
  validateSearch: parseCharacterSearch,
  component: CharacterSearchPage
})
