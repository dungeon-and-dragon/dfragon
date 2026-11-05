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

export type RecentCharacter = CharacterDisplay & { viewedAt: number }

type PersistedRecentCharacters = { recentCharacters: RecentCharacter[] }

export const RECENT_CHARACTER_LIMIT = 10

const RECENT_CHARACTERS_VERSION = 1

function isRecentCharacter(value: unknown): value is RecentCharacter {
  return isCharacterDisplay(value) && 'viewedAt' in value && isFiniteNumber(value.viewedAt)
}

function readPersistedRecentCharacters(persisted: unknown): PersistedRecentCharacters | undefined {
  if (!isRecord(persisted)) {
    return undefined
  }

  const recentCharacters = readStoredCharacters(
    persisted.recentCharacters,
    isRecentCharacter
  ).slice(0, RECENT_CHARACTER_LIMIT)

  return { recentCharacters }
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
