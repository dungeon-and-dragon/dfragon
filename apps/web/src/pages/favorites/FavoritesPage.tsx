import { HeartIcon, IconButton } from '@dfragon/ui'
import { CharacterTable, type CharacterTableAction } from '#widgets/character-table'
import { ListBox } from '#shared/ui/ListBox'
import { TitleBox, TitleStat } from '#shared/ui/TitleBox'
import { useFavoriteCharacterStore } from '#features/favorite-character'
import type { CharacterKey } from '#entities/character'

const integer = new Intl.NumberFormat('ko-KR')

export function FavoritesPage(): React.JSX.Element {
  const favoriteCharacters = useFavoriteCharacterStore((state) => state.favoriteCharacters)
  const empty = favoriteCharacters.length === 0
  const unfavorite: CharacterTableAction = {
    name: '해제',
    render: (row) => <UnfavoriteButton character={row} />
  }

  return (
    <div className="flex flex-col">
      <TitleBox title="즐겨찾기">
        {empty ? null : (
          <TitleStat label="캐릭터" value={integer.format(favoriteCharacters.length)} />
        )}
      </TitleBox>
      <ListBox name="즐겨찾기한 캐릭터">
        {empty ? (
          <p className="state">즐겨찾기한 캐릭터가 없습니다.</p>
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
      icon={<HeartIcon filled className="text-fg" />}
      onClick={handleClick}
    />
  )
}
