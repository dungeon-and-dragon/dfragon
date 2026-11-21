import { createFileRoute } from '@tanstack/react-router'
import { CharacterDetailPage, parseCharacterTabSearch } from '#pages/character'
import { pageHead } from '#shared/lib/page-head'

export const Route = createFileRoute('/c/$serverId/$characterId')({
  head: ({ params: { serverId, characterId } }) =>
    pageHead({
      title: '캐릭터',
      path: `/c/${encodeURIComponent(serverId)}/${encodeURIComponent(characterId)}`
    }),
  validateSearch: parseCharacterTabSearch,
  component: CharacterDetailPage
})
