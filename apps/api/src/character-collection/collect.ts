import type { CharacterBasicInput, CollectedCharacter } from '@dfragon/database'
import { NeopleRequestFailure } from '@dfragon/neople'
import { type CollectionResult, isNeopleUnavailable } from '../neople-collection/pace.js'

export type CollectionFailure = `neople-${'internal' | 'api'}`

export interface CollectionStore {
  takeBatch(limit: number): Promise<CollectedCharacter[]>
  recordBasic(basic: CharacterBasicInput): Promise<void>
  recordFailure(character: CollectedCharacter, failure: CollectionFailure): Promise<void>
}

export type FetchCharacterBasic = (character: CollectedCharacter) => Promise<CharacterBasicInput>

export async function collectCharacter(
  character: CollectedCharacter,
  fetchBasic: FetchCharacterBasic,
  store: CollectionStore
): Promise<CollectionResult> {
  let basic: CharacterBasicInput
  try {
    basic = await fetchBasic(character)
  } catch (error) {
    if (!(error instanceof NeopleRequestFailure)) {
      throw error
    }

    if (isNeopleUnavailable(error.kind)) {
      return 'unavailable'
    }
    await store.recordFailure(character, `neople-${error.kind}`)

    return 'failed'
  }
  await store.recordBasic(basic)

  return 'recorded'
}
