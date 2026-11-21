import { createFileRoute } from '@tanstack/react-router'
import { CharacterDetailPage, parseCharacterTabSearch } from '#pages/character'

export const Route = createFileRoute('/c/$serverId/$characterId')({
  validateSearch: parseCharacterTabSearch,
  component: CharacterDetailPage
})
