import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { isFiniteNumber, isRecord } from '@dfragon/lib/utils/shape-check'
import {
  isCharacterDisplay,
  isSameCharacter,
  pickCharacterDisplay,
  readStoredCharacters,
  refreshCharacterDisplay,
  type CharacterDisplay,
  type CharacterKey
} from '../lib/stored-character'

export type FavoriteCharacter = CharacterDisplay & { savedAt: number }

type PersistedFavoriteCharacters = { favoriteCharacters: FavoriteCharacter[] }

const FAVORITE_CHARACTERS_VERSION = 1

function isFavoriteCharacter(value: unknown): value is FavoriteCharacter {
  return isCharacterDisplay(value) && 'savedAt' in value && isFiniteNumber(value.savedAt)
}

function readPersistedFavoriteCharacters(
  persisted: unknown
): PersistedFavoriteCharacters | undefined {
  if (!isRecord(persisted)) {
    return undefined
  }

  const favoriteCharacters = readStoredCharacters(persisted.favoriteCharacters, isFavoriteCharacter)

  return { favoriteCharacters }
}

export const useFavoriteCharacterStore = create<
  PersistedFavoriteCharacters & {
    addFavoriteCharacter: (character: CharacterDisplay) => void
    removeFavoriteCharacter: (key: CharacterKey) => void
    refreshFavoriteCharacter: (latest: CharacterDisplay) => void
  }
>()(
  persist(
    (set) => ({
      favoriteCharacters: [],
      addFavoriteCharacter: (character) =>
        set(({ favoriteCharacters }) => {
          if (favoriteCharacters.some((favorite) => isSameCharacter(favorite, character))) {
            return { favoriteCharacters }
          }

          const favorite = { ...pickCharacterDisplay(character), savedAt: Date.now() }

          return { favoriteCharacters: [favorite, ...favoriteCharacters] }
        }),
      removeFavoriteCharacter: (key) =>
        set(({ favoriteCharacters }) => {
          const remaining = favoriteCharacters.filter((favorite) => !isSameCharacter(favorite, key))

          return { favoriteCharacters: remaining }
        }),
      refreshFavoriteCharacter: (latest) =>
        set(({ favoriteCharacters }) => {
          const refreshed = refreshCharacterDisplay(favoriteCharacters, latest)

          return { favoriteCharacters: refreshed }
        })
    }),
    {
      name: 'dfragon:favorite-characters',
      version: FAVORITE_CHARACTERS_VERSION,
      partialize: ({ favoriteCharacters }) => ({ favoriteCharacters }),
      migrate: (persisted) =>
        readPersistedFavoriteCharacters(persisted) ?? { favoriteCharacters: [] },
      merge: (persisted, current) => ({ ...current, ...readPersistedFavoriteCharacters(persisted) })
    }
  )
)
