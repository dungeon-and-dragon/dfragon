import type { CharacterSearchQuery } from '#entities/character'
import { CharacterSearchBox } from '#widgets/global-bar'
import { CharacterSearchResult } from './CharacterSearchResult'

export function SimulatorSearchScreen({
  query
}: {
  query: CharacterSearchQuery
}): React.JSX.Element {
  const searched = query.characterName !== ''

  return (
    <div className="flex flex-col">
      <div
        className={`section flex min-w-0 justify-center px-4${searched ? '' : ' pt-16 pb-16 max-sm:pt-12'}`}
      >
        <CharacterSearchBox size="large" characterPage="simulator" />
      </div>
      {searched && <CharacterSearchResult query={query} characterPage="simulator" />}
    </div>
  )
}
