import { useEffect } from 'react'
import type { CharacterDetailView } from '#core/character/character-detail-view'
import { characterDisplayOf } from '../lib/stored-character'
import { useFavoriteCharacterStore } from './useFavoriteCharacterStore'
import { useRecentCharacterStore } from './useRecentCharacterStore'

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
