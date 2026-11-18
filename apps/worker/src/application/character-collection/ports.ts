import type { CharacterBasicInput, CollectedCharacter } from '@dfragon/database'

export type FetchCharacterBasic = (character: CollectedCharacter) => Promise<CharacterBasicInput>
export type EnqueueCharacters = (characters: readonly CollectedCharacter[]) => Promise<void>
export type ReadModifiedTime = (path: string) => Promise<number | undefined>
export type ImportCharacters = (path: string, enqueue: EnqueueCharacters) => Promise<number>
export type Pause = (milliseconds: number) => Promise<void>

export type CharacterCollectionPorts = {
  importFiles: readonly string[]
  readModifiedTime: ReadModifiedTime
  importCharacters: ImportCharacters
  fetchBasic: FetchCharacterBasic
  readConcurrency: () => number
  report: (code: string, details?: Record<string, number>) => void
  pause: Pause
}
