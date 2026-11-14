import type { CharacterBasicInput, CollectedCharacter } from '@dfragon/database'

export type CollectionFailure = `neople-${'internal' | 'api'}`

export interface CollectionRepository {
  takeBatch(limit: number): Promise<CollectedCharacter[]>
  recordBasic(basic: CharacterBasicInput): Promise<void>
  recordFailure(character: CollectedCharacter, failure: CollectionFailure): Promise<void>
  enqueue(characters: readonly CollectedCharacter[]): Promise<void>
}
