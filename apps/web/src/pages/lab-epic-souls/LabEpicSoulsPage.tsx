import { ClientOnly } from '@tanstack/react-router'
import { useMyAdventureStore } from '#entities/adventure-guild'
import { LabEpicSoulsScreen } from './LabEpicSoulsScreen'

export function LabEpicSoulsPage(): React.JSX.Element {
  // 저장한 모험단은 브라우저에만 있으므로, 서버 HTML과 첫 hydration은 빈 검색 폼으로 맞춘다.
  return (
    <ClientOnly fallback={<LabEpicSoulsScreen />}>
      <MyAdventureEpicSouls />
    </ClientOnly>
  )
}

function MyAdventureEpicSouls(): React.JSX.Element {
  const adventureName = useMyAdventureStore((state) => state.adventureName)
  const changeAdventureName = useMyAdventureStore((state) => state.changeAdventureName)

  return (
    <LabEpicSoulsScreen
      initialAdventureName={adventureName}
      onAdventureOpen={changeAdventureName}
    />
  )
}
