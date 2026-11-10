import type { CharacterBasicInput, CollectedCharacter } from '@dfragon/database'

export type CollectionFailure = `neople-${'internal' | 'api'}`

export interface CollectionStore {
  takeBatch(limit: number): Promise<CollectedCharacter[]>
  recordBasic(basic: CharacterBasicInput): Promise<void>
  recordFailure(character: CollectedCharacter, failure: CollectionFailure): Promise<void>
}

export type FetchCharacterBasic = (character: CollectedCharacter) => Promise<CharacterBasicInput>
export type EnqueueCharacters = (characters: readonly CollectedCharacter[]) => Promise<void>
export type ReadModifiedTime = (path: string) => Promise<number | undefined>
export type ImportCharacters = (path: string, enqueue: EnqueueCharacters) => Promise<number>
export type Pause = (milliseconds: number) => Promise<void>
