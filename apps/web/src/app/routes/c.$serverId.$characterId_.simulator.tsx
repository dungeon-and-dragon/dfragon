import { createFileRoute } from '@tanstack/react-router'
import { CharacterSimulatorPage, parseSimulatorSearch } from '#pages/character-simulator'
import { pageHead } from '#shared/lib/page-head'

export const Route = createFileRoute('/c/$serverId/$characterId_/simulator')({
  validateSearch: parseSimulatorSearch,
  head: ({ params: { serverId, characterId } }) => {
    const path = `/c/${encodeURIComponent(serverId)}/${encodeURIComponent(characterId)}/simulator`

    return pageHead({ title: '장비 시뮬레이터', path, indexed: false })
  },
  component: CharacterSimulatorPage
})
