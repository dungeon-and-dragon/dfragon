import { IconButton } from '@dfragon/ui'
import { StarIcon } from './StarIcon'
import { useFavoriteCharacterStore } from '../hooks/useFavoriteCharacterStore'
import { type CharacterDisplay, isSameCharacter } from '../lib/stored-character'

export function FavoriteToggle({
  character,
  onToggle
}: {
  character: CharacterDisplay
  onToggle?: () => void
}): React.JSX.Element {
  const favorite = useFavoriteCharacterStore((state) =>
    state.favoriteCharacters.some((saved) => isSameCharacter(saved, character))
  )
  const addFavoriteCharacter = useFavoriteCharacterStore((state) => state.addFavoriteCharacter)
  const removeFavoriteCharacter = useFavoriteCharacterStore(
    (state) => state.removeFavoriteCharacter
  )

  function toggle(): void {
    if (favorite) {
      removeFavoriteCharacter(character)
    } else {
      addFavoriteCharacter(character)
    }
    onToggle?.()
  }

  return (
    <IconButton
      size="sm"
      aria-label={favorite ? '즐겨찾기 해제' : '즐겨찾기에 더하기'}
      icon={<StarIcon filled={favorite} />}
      onClick={toggle}
    />
  )
}
