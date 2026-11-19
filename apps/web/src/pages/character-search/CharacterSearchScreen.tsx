import {
  type CharacterSearchQuery,
  isSearchableCharacterName,
  type SearchedCharacter
} from '#core/api'
import {
  CharacterTable,
  type CharacterTableRow,
  SkeletonRow
} from '#components/table/CharacterTable'
import { ListBox } from '#shared/ui/ListBox'
import { TitleBox, TitleStat } from '#shared/ui/TitleBox'
import { characterSearchServerOptions } from '#shared/config/server-options'
import { useSearchedCharacters } from './hooks/useSearchedCharacters'

const LOADING_ROWS = 5
const NO_AFFILIATIONS = [] as const

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
      {isSearchableCharacterName(query.characterName) ? (
        <SearchedCharacterList query={query} />
      ) : (
        <ListBox name={query.characterName}>
          <p className="state">검색할 수 없는 이름입니다.</p>
        </ListBox>
      )}
    </div>
  )
}

function SearchedCharacterList({ query }: { query: CharacterSearchQuery }): React.JSX.Element {
  const result = useSearchedCharacters(query)
  const name = query.characterName
  switch (result.status) {
    case 'loading':
      return (
        <ListBox name={name}>
          <div aria-busy="true">
            <span role="status" className="sr-only">
              캐릭터를 찾는 중입니다.
            </span>
            <CharacterTable
              rows={[]}
              ranked={false}
              affiliations={NO_AFFILIATIONS}
              trailing={Array.from({ length: LOADING_ROWS }, (_, index) => (
                <SkeletonRow key={index} ranked={false} affiliations={NO_AFFILIATIONS} />
              ))}
            />
          </div>
        </ListBox>
      )
    case 'error':
      return (
        <ListBox name={name}>
          <p role="alert" className="state state-error">
            {result.message}
          </p>
        </ListBox>
      )
    case 'success':
      if (result.value.length === 0) {
        return (
          <ListBox name={name}>
            <p className="state">캐릭터를 찾지 못했습니다.</p>
          </ListBox>
        )
      }

      return (
        <ListBox name={name}>
          <CharacterTable
            rows={result.value.map(tableRow)}
            ranked={false}
            affiliations={NO_AFFILIATIONS}
            adventureBesideName
          />
        </ListBox>
      )
  }
}

function tableRow(candidate: SearchedCharacter): CharacterTableRow {
  return { ...candidate, level: null, guildId: null, guildName: null, role: null }
}
