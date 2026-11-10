import type { CharacterBasicInput, CollectedCharacter } from '@dfragon/database'
import { CharacterCollectionFailure } from '../../domain/character-collection/failure.js'
import type { CollectionStore, FetchCharacterBasic } from './ports.js'

export type CollectionResult = 'recorded' | 'failed' | 'unavailable'

export async function collectCharacter(
  character: CollectedCharacter,
  fetchBasic: FetchCharacterBasic,
  store: CollectionStore
): Promise<CollectionResult> {
  let basic: CharacterBasicInput
  try {
    basic = await fetchBasic(character)
  } catch (error) {
    if (!(error instanceof CharacterCollectionFailure)) {
      throw error
    }

    // 한도 초과, 점검, timeout은 캐릭터 문제가 아니라 기록하지 않고 나중에 같은 캐릭터를 다시 부른다.
    if (error.kind === 'unavailable' || error.kind === 'timeout') {
      return 'unavailable'
    }
    await store.recordFailure(character, `neople-${error.kind}`)

    return 'failed'
  }
  await store.recordBasic(basic)

  return 'recorded'
}
