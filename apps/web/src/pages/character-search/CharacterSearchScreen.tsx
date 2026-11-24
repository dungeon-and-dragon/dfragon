import type { CharacterSearchQuery } from '#entities/character'
import { TitleBox, TitleStat } from '#shared/ui/TitleBox'
import { characterSearchServerOptions } from '#shared/config/server-options'
import { CharacterSearchResult } from './CharacterSearchResult'

export function CharacterSearchScreen({
  query
}: {
  query: CharacterSearchQuery
}): React.JSX.Element {
  const server = characterSearchServerOptions.find(({ id }) => id === query.serverId)

  return (
    <div className="flex flex-col">
      <TitleBox title="캐릭터 검색">
        {server != null && <TitleStat label="서버" value={server.label} numeric={false} />}
      </TitleBox>
      <CharacterSearchResult query={query} characterPage="detail" />
    </div>
  )
}
