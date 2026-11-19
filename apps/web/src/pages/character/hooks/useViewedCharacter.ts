import { useEffect } from 'react'
import { type CharacterDetailView, characterDisplayOf } from '#entities/character'
import { useFavoriteCharacterStore } from '#hooks/useFavoriteCharacterStore'
import { useRecentCharacterStore } from '#hooks/useRecentCharacterStore'

export function useViewedCharacter(detail: CharacterDetailView | null): void {
  const addRecentCharacter = useRecentCharacterStore((state) => state.addRecentCharacter)
  const refreshFavoriteCharacter = useFavoriteCharacterStore(
    (state) => state.refreshFavoriteCharacter
  )

  useEffect(() => {
    if (detail === null) {
      return
    }
    const display = characterDisplayOf(detail)
    if (display == null) {
      return
    }
    addRecentCharacter(display)
    refreshFavoriteCharacter(display)
  }, [detail, addRecentCharacter, refreshFavoriteCharacter])
}
