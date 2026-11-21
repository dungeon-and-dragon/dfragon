import { createFileRoute } from '@tanstack/react-router'
import { CharacterSearchPage, parseCharacterSearch } from '#pages/character-search'
import { pageHead } from '#shared/lib/page-head'

export const Route = createFileRoute('/search')({
  head: () => pageHead({ title: '캐릭터 검색', path: '/search', indexed: false }),
  validateSearch: parseCharacterSearch,
  component: CharacterSearchPage
})
