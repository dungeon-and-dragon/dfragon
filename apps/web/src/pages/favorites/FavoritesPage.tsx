import { HeartIcon, IconButton } from '@dfragon/ui'
import { CharacterTable, type CharacterTableAction } from '#widgets/character-table'
import { useFavoriteCharacterStore } from '#features/favorite-character'
import type { CharacterKey } from '#entities/character'

export function FavoritesPage(): React.JSX.Element {
  const favoriteCharacters = useFavoriteCharacterStore((state) => state.favoriteCharacters)
  const empty = favoriteCharacters.length === 0
  const unfavorite: CharacterTableAction = {
    name: '해제',
    render: (row) => <UnfavoriteButton character={row} />
  }

  return (
    <div className="flex flex-col">
      <section aria-label="즐겨찾기한 캐릭터" className="section min-w-0 pb-0">
        <h2 className="section-title">즐겨찾기한 캐릭터</h2>
        {empty ? (
          <p className="state">즐겨찾기한 캐릭터가 없습니다.</p>
        ) : (
          <CharacterTable rows={favoriteCharacters} ranked={false} action={unfavorite} />
        )}
      </section>
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
