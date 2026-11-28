import { useState } from 'react'
import { AdventureNameForm } from '#features/adventure-search'
import { LabTabs } from '#widgets/lab-tabs'
import { useAdventureCharacters } from './api/useAdventureCharacters'
import { EpicSoulTable } from './ui/EpicSoulTable'

const SKELETON_ROWS = 3

export function LabEpicSoulsScreen({
  initialAdventureName = null,
  onAdventureOpen
}: {
  initialAdventureName?: string | null
  onAdventureOpen?: (adventureName: string) => void
}): React.JSX.Element {
  const [adventureName, setAdventureName] = useState(initialAdventureName)

  function openAdventure(next: string): void {
    setAdventureName(next)
    onAdventureOpen?.(next)
  }

  return (
    <div className="flex flex-col">
      <LabTabs />
      <div className="section flex flex-wrap items-center gap-3 px-4">
        <AdventureNameForm
          initialName={initialAdventureName ?? ''}
          onAdventureOpen={openAdventure}
          className="max-sm:w-full"
        />
      </div>
      {adventureName !== null && <AdventureEpicSouls adventureName={adventureName} />}
    </div>
  )
}

function AdventureEpicSouls({ adventureName }: { adventureName: string }): React.JSX.Element {
  const result = useAdventureCharacters(adventureName)

  switch (result.status) {
    case 'loading':
      return (
        <div aria-busy="true" className="flex flex-col gap-2 p-4">
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <span key={index} className="skeleton h-[20px]" />
          ))}
        </div>
      )
    case 'error':
      return <p className="p-4 text-fg-muted">모험단 캐릭터를 받지 못했습니다.</p>
    case 'success': {
      const { characters } = result.value

      if (characters.length === 0) {
        return <p className="p-4 text-fg-muted">모험단을 찾지 못했습니다.</p>
      }

      return <EpicSoulTable characters={characters} />
    }
  }
}
