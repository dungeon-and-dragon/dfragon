import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { z } from 'zod'
import {
  characterDisplaySchema,
  isSameCharacter,
  pickCharacterDisplay,
  refreshCharacterDisplay,
  storedCharacterList,
  type CharacterDisplay,
  type CharacterKey
} from '../lib/stored-character'

const favoriteCharacterSchema = characterDisplaySchema.extend({ savedAt: z.number() })

const persistedFavoriteCharactersSchema = z.object({
  favoriteCharacters: storedCharacterList(favoriteCharacterSchema)
})

export type FavoriteCharacter = z.infer<typeof favoriteCharacterSchema>

type PersistedFavoriteCharacters = z.infer<typeof persistedFavoriteCharactersSchema>

const FAVORITE_CHARACTERS_VERSION = 1

function readPersistedFavoriteCharacters(
  persisted: unknown
): PersistedFavoriteCharacters | undefined {
  return persistedFavoriteCharactersSchema.safeParse(persisted).data
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
