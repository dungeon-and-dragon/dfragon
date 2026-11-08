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

export const RECENT_CHARACTER_LIMIT = 10

const recentCharacterSchema = characterDisplaySchema.extend({ viewedAt: z.number() })

const persistedRecentCharactersSchema = z.object({
  recentCharacters: storedCharacterList(recentCharacterSchema).transform((characters) =>
    characters.slice(0, RECENT_CHARACTER_LIMIT)
  )
})

export type RecentCharacter = z.infer<typeof recentCharacterSchema>

type PersistedRecentCharacters = z.infer<typeof persistedRecentCharactersSchema>

const RECENT_CHARACTERS_VERSION = 1

function readPersistedRecentCharacters(persisted: unknown): PersistedRecentCharacters | undefined {
  return persistedRecentCharactersSchema.safeParse(persisted).data
}

export const useRecentCharacterStore = create<
  PersistedRecentCharacters & {
    addRecentCharacter: (character: CharacterDisplay) => void
    removeRecentCharacter: (key: CharacterKey) => void
    refreshRecentCharacter: (latest: CharacterDisplay) => void
  }
>()(
  persist(
    (set) => ({
      recentCharacters: [],
      addRecentCharacter: (character) =>
        set(({ recentCharacters }) => {
          const viewed = { ...pickCharacterDisplay(character), viewedAt: Date.now() }
          const others = recentCharacters.filter((recent) => !isSameCharacter(recent, character))

          return { recentCharacters: [viewed, ...others].slice(0, RECENT_CHARACTER_LIMIT) }
        }),
      removeRecentCharacter: (key) =>
        set(({ recentCharacters }) => {
          const remaining = recentCharacters.filter((recent) => !isSameCharacter(recent, key))

          return { recentCharacters: remaining }
        }),
      refreshRecentCharacter: (latest) =>
        set(({ recentCharacters }) => {
          const refreshed = refreshCharacterDisplay(recentCharacters, latest)

          return { recentCharacters: refreshed }
        })
    }),
    {
      name: 'dfragon:recent-characters',
      version: RECENT_CHARACTERS_VERSION,
      partialize: ({ recentCharacters }) => ({ recentCharacters }),
      migrate: (persisted) => readPersistedRecentCharacters(persisted) ?? { recentCharacters: [] },
      merge: (persisted, current) => ({ ...current, ...readPersistedRecentCharacters(persisted) })
    }
  )
)
