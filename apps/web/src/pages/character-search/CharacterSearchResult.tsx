import {
  type CharacterPage,
  type CharacterSearchQuery,
  isSearchableCharacterName,
  type SearchedCharacter
} from '#entities/character'
import { CharacterTable, type CharacterTableRow, SkeletonRow } from '#widgets/character-table'
import { ListBox } from '#shared/ui/ListBox'
import { useSearchedCharacters } from './api/useSearchedCharacters'

const LOADING_ROWS = 5
const NO_AFFILIATIONS = [] as const

export function CharacterSearchResult({
  query,
  characterPage
}: {
  query: CharacterSearchQuery
  characterPage: CharacterPage
}): React.JSX.Element {
  if (!isSearchableCharacterName(query.characterName)) {
    return (
      <ListBox name={query.characterName}>
        <p className="state">검색할 수 없는 이름입니다.</p>
      </ListBox>
    )
  }

  return <SearchedCharacterList query={query} characterPage={characterPage} />
}

function SearchedCharacterList({
  query,
  characterPage
}: {
  query: CharacterSearchQuery
  characterPage: CharacterPage
}): React.JSX.Element {
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
              scorePlacement="column"
              affiliations={NO_AFFILIATIONS}
              trailing={Array.from({ length: LOADING_ROWS }, (_, index) => (
                <SkeletonRow
                  key={index}
                  ranked={false}
                  scorePlacement="column"
                  affiliations={NO_AFFILIATIONS}
                />
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
            scorePlacement="column"
            affiliations={NO_AFFILIATIONS}
            adventureBesideName
            characterPage={characterPage}
          />
        </ListBox>
      )
  }
}

function tableRow(candidate: SearchedCharacter): CharacterTableRow {
  return { ...candidate, level: null, guildId: null, guildName: null, role: null }
}
