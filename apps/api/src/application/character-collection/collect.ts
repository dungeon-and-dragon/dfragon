import type { CharacterBasicInput, CollectedCharacter } from '@dfragon/database'
import { CharacterCollectionFailure } from '../../domain/character-collection/failure.js'
import type { FetchCharacterBasic } from './ports.js'
import type { CollectionRepository } from './repository.js'

export type CollectionResult = 'recorded' | 'failed' | 'unavailable'

export async function collectCharacter(
  character: CollectedCharacter,
  fetchBasic: FetchCharacterBasic,
  repository: Pick<CollectionRepository, 'recordBasic' | 'recordFailure'>
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

    await repository.recordFailure(character, `neople-${error.kind}`)

    return 'failed'
  }

  await repository.recordBasic(basic)

  return 'recorded'
}
