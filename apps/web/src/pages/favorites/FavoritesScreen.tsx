import { IconButton } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { StarIcon } from '../../components/StarIcon'
import { CharacterTable, type CharacterTableAction } from '../../components/table/CharacterTable'
import { ListBox } from '../../components/table/ListBox'
import { TitleBox, TitleStat } from '../../components/table/TitleBox'
import { useFavoriteCharacterStore } from '../../hooks/useFavoriteCharacterStore'
import type { CharacterKey } from '../../lib/stored-character'
import { styles } from './FavoritesScreen.style'

const integer = new Intl.NumberFormat('ko-KR')

export function FavoritesScreen(): React.JSX.Element {
  const favoriteCharacters = useFavoriteCharacterStore((state) => state.favoriteCharacters)
  const empty = favoriteCharacters.length === 0
  const unfavorite: CharacterTableAction = {
    name: '해제',
    render: (row) => <UnfavoriteButton character={row} />
  }

  return (
    <div {...stylex.props(styles.screen)}>
      <TitleBox title="즐겨찾기">
        {empty ? null : (
          <TitleStat label="캐릭터" value={integer.format(favoriteCharacters.length)} />
        )}
      </TitleBox>
      <ListBox name="즐겨찾기한 캐릭터">
        {empty ? (
          <p {...stylex.props(styles.empty)}>즐겨찾기한 캐릭터가 없습니다.</p>
        ) : (
          <CharacterTable rows={favoriteCharacters} ranked={false} action={unfavorite} />
        )}
      </ListBox>
    </div>
  )
}

function UnfavoriteButton({ character }: { character: CharacterKey }): React.JSX.Element {
  const removeFavoriteCharacter = useFavoriteCharacterStore(
    (state) => state.removeFavoriteCharacter
  )

  function handleClick(): void {
    removeFavoriteCharacter(character)
  }

  return (
    <IconButton
      size="sm"
      aria-label="즐겨찾기 해제"
      icon={<StarIcon filled />}
      onClick={handleClick}
    />
  )
}
