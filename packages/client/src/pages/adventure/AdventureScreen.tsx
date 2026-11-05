import * as stylex from '@stylexjs/stylex'
import { MISSING_VALUE } from '@dfragon/client-core/constants/cards'
import type { StoredCharacter } from '@dfragon/client-core/shared/ranking/ranking-stats'
import { CharacterListBox } from '../../components/table/CharacterListBox'
import { TitleBox, TitleStat } from '../../components/table/TitleBox'
import { useAdventureCharacters } from '../../hooks/useAdventureCharacters'
import type { LoadedResult } from '../../hooks/useLoadedResult'
import { styles } from './AdventureScreen.style'

const integer = new Intl.NumberFormat('ko-KR')

export function AdventureScreen({ adventureName }: { adventureName: string }): React.JSX.Element {
  const result = useAdventureCharacters(adventureName)
  const characters: LoadedResult<readonly StoredCharacter[]> =
    result.status === 'success' ? { status: 'success', value: result.value.characters } : result

  return (
    <div {...stylex.props(styles.screen)}>
      <TitleBox title={adventureName}>
        {result.status === 'success' && <AdventureStats characters={result.value.characters} />}
      </TitleBox>
      <CharacterListBox name="캐릭터" result={characters} affiliation="guild" />
    </div>
  )
}

function AdventureStats({
  characters
}: {
  characters: readonly StoredCharacter[]
}): React.JSX.Element {
  const fames = characters.map(({ fame }) => fame).filter((fame) => fame != null)

  return (
    <>
      <TitleStat label="캐릭터" value={integer.format(characters.length)} />
      <TitleStat
        label="최고 명성"
        value={fames.length > 0 ? integer.format(Math.max(...fames)) : MISSING_VALUE}
      />
    </>
  )
}
