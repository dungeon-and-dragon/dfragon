import { Checkbox } from '@dfragon/ui'
import { useState } from 'react'
import { AdventureNameForm } from '#features/adventure-search'
import { LabTabs } from '#widgets/lab-tabs'
import { useAdventureCharacters } from './api/useAdventureCharacters'
import { EpicSoulTable } from './ui/EpicSoulTable'

const SKELETON_ROWS = 3

export function LabEpicSoulsScreen({
  initialAdventureName = null
}: {
  initialAdventureName?: string | null
}): React.JSX.Element {
  const [adventureName, setAdventureName] = useState(initialAdventureName)
  const [includePrimordial, setIncludePrimordial] = useState(false)

  return (
    <div className="flex flex-col">
      <LabTabs />
      <div className="section flex flex-wrap items-center gap-3 px-4">
        <AdventureNameForm
          initialName={initialAdventureName ?? ''}
          onAdventureOpen={setAdventureName}
          className="max-sm:w-full"
        />
        {adventureName !== null && (
          <label className="flex h-control-sm cursor-pointer items-center gap-2">
            <Checkbox checked={includePrimordial} onCheckedChange={setIncludePrimordial} />
            태초 장비 포함해서 계산
          </label>
        )}
      </div>
      {adventureName !== null && (
        <AdventureEpicSouls adventureName={adventureName} includePrimordial={includePrimordial} />
      )}
    </div>
  )
}

function AdventureEpicSouls({
  adventureName,
  includePrimordial
}: {
  adventureName: string
  includePrimordial: boolean
}): React.JSX.Element {
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

      return <EpicSoulTable characters={characters} includePrimordial={includePrimordial} />
    }
  }
}
