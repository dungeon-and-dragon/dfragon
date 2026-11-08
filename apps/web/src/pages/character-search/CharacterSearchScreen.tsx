import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import {
  type CharacterSearchQuery,
  isSearchableCharacterName,
  type SearchedCharacter
} from '#core/shared/api/character-schemas'
import {
  CharacterTable,
  type CharacterTableRow,
  SkeletonRow
} from '../../components/table/CharacterTable'
import { ListBox } from '../../components/table/ListBox'
import { TitleBox, TitleStat } from '../../components/table/TitleBox'
import { characterSearchServerOptions } from '../../constants/server-options'
import { useSearchedCharacters } from '../../hooks/useSearchedCharacters'
import { styles } from './CharacterSearchScreen.style'

const LOADING_ROWS = 5
const NO_AFFILIATIONS = [] as const

export function CharacterSearchScreen({
  query
}: {
  query: CharacterSearchQuery
}): React.JSX.Element {
  const server = characterSearchServerOptions.find(({ id }) => id === query.serverId)

  return (
    <div {...stylex.props(styles.screen)}>
      <TitleBox title="캐릭터 검색">
        {server != null && <TitleStat label="서버" value={server.label} />}
      </TitleBox>
      {isSearchableCharacterName(query.characterName) ? (
        <SearchedCharacterList query={query} />
      ) : (
        <ListBox name="검색할 수 없는 이름입니다." />
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
            <span role="status" {...stylex.props(shapes.srOnly)}>
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
          <p role="alert" {...stylex.props(styles.state)}>
            {result.message}
          </p>
        </ListBox>
      )
    case 'success':
      if (result.value.length === 0) {
        return <ListBox name="캐릭터를 찾지 못했습니다." />
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
  return { ...candidate, level: null, guildId: null, guildName: null }
}
