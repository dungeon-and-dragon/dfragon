import { useEffect } from 'react'
import type { CharacterDetailView } from '#core/shared/search/character-detail-view'
import { characterDisplaySchema } from '../lib/stored-character'
import { useFavoriteCharacterStore } from './useFavoriteCharacterStore'
import { useRecentCharacterStore } from './useRecentCharacterStore'

export function useViewedCharacter(character: CharacterDetailView['character'] | null): void {
  const addRecentCharacter = useRecentCharacterStore((state) => state.addRecentCharacter)
  const refreshFavoriteCharacter = useFavoriteCharacterStore(
    (state) => state.refreshFavoriteCharacter
  )

  useEffect(() => {
    const display = characterDisplaySchema.safeParse(character).data
    if (display == null) {
      return
    }
    addRecentCharacter(display)
    refreshFavoriteCharacter(display)
  }, [character, addRecentCharacter, refreshFavoriteCharacter])
}
