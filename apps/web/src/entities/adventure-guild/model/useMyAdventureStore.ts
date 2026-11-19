import { z } from 'zod'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const persistedMyAdventureSchema = z.object({ adventureName: z.string().min(1).nullable() })

type PersistedMyAdventure = z.infer<typeof persistedMyAdventureSchema>

const MY_ADVENTURE_VERSION = 1

function readPersistedMyAdventure(persisted: unknown): PersistedMyAdventure | undefined {
  return persistedMyAdventureSchema.safeParse(persisted).data
}

export const useMyAdventureStore = create<
  PersistedMyAdventure & { changeAdventureName: (adventureName: string) => void }
>()(
  persist(
    (set) => ({
      adventureName: null,
      changeAdventureName: (adventureName) => set({ adventureName })
    }),
    {
      name: 'dfragon:my-adventure',
      version: MY_ADVENTURE_VERSION,
      partialize: ({ adventureName }) => ({ adventureName }),
      migrate: (persisted) => readPersistedMyAdventure(persisted) ?? { adventureName: null },
      merge: (persisted, current) => ({ ...current, ...readPersistedMyAdventure(persisted) })
    }
  )
)
