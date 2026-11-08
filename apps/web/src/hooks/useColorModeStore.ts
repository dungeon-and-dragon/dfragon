import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { isRecord } from '@dfragon/lib/utils/shape-check'

export type ColorMode = 'light' | 'dark'

type PersistedColorMode = { colorMode: ColorMode | null }

const COLOR_MODE_VERSION = 1

function isColorMode(value: unknown): value is ColorMode {
  return value === 'light' || value === 'dark'
}

function readPersistedColorMode(persisted: unknown): PersistedColorMode | undefined {
  if (!isRecord(persisted) || !isColorMode(persisted.colorMode)) {
    return undefined
  }

  return { colorMode: persisted.colorMode }
}

export const useColorModeStore = create<
  PersistedColorMode & { changeColorMode: (colorMode: ColorMode) => void }
>()(
  persist(
    (set) => ({
      colorMode: null,
      changeColorMode: (colorMode) => set({ colorMode })
    }),
    {
      // apps/web/index.html의 첫 그리기 전 script가 이 key와 zustand persist 형식({ state, version })을 직접 읽는다.
      name: 'dfragon:color-mode',
      version: COLOR_MODE_VERSION,
      partialize: ({ colorMode }) => ({ colorMode }),
      migrate: (persisted) => readPersistedColorMode(persisted) ?? { colorMode: null },
      merge: (persisted, current) => ({ ...current, ...readPersistedColorMode(persisted) })
    }
  )
)
