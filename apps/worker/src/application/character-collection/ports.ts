import type { CharacterBasicInput, CollectedCharacter } from '@dfragon/database'
import type { FameWindow } from '#domain/character-collection/index.js'

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

export type FameSearchTarget = {
  serverId: string
  jobId: string
  jobGrowId: string
}

export type FetchedFamePage =
  | { status: 'fetched'; characters: { characterId: string; fame: number }[] }
  | { status: 'unavailable' }
  | { status: 'failed' }

export type CharacterDiscoveryPorts = {
  readTargets: () => Promise<FameSearchTarget[]>
  readTopFame: () => Promise<number>
  fetchFamePage: (target: FameSearchTarget, window: FameWindow) => Promise<FetchedFamePage>
  readConcurrency: () => number
  report: (code: string, details: Readonly<Record<string, string | number>>) => void
  pause: Pause
}
