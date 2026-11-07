import type {
  CharacterBasicInput,
  CharacterSkillStyleInput,
  CollectedCharacter,
  SkillStyleSampleJob
} from '@dfragon/database'
import { type NeopleCharacterSkillStyle, NeopleRequestFailure } from '@dfragon/neople'
import { type CollectionResult, isNeopleUnavailable } from '../neople-collection/concurrency.js'

export interface SkillStyleStore {
  readJobs(): Promise<SkillStyleSampleJob[]>
  takeBatch(
    job: SkillStyleSampleJob,
    fetchedBefore: Date,
    skipped: readonly CollectedCharacter[],
    limit: number
  ): Promise<CollectedCharacter[]>
  record(basic: CharacterBasicInput, style: CharacterSkillStyleInput): Promise<void>
  deleteSkillStyle(character: CollectedCharacter): Promise<void>
}

export type FetchSkillStyle = (
  character: CollectedCharacter
) => Promise<{ basic: CharacterBasicInput; skillStyle: NeopleCharacterSkillStyle }>

export async function collectSkillStyle(
  character: CollectedCharacter,
  fetchSkillStyle: FetchSkillStyle,
  store: SkillStyleStore
): Promise<CollectionResult> {
  let response: Awaited<ReturnType<FetchSkillStyle>>
  try {
    response = await fetchSkillStyle(character)
  } catch (error) {
    if (!(error instanceof NeopleRequestFailure)) {
      throw error
    }

    if (isNeopleUnavailable(error.kind)) {
      return 'unavailable'
    }

    if (error.characterNotFound) {
      await store.deleteSkillStyle(character)
    }

    return 'failed'
  }
  const { basic, skillStyle } = response
  const { serverId, characterId } = basic
  await store.record(basic, { serverId, characterId, ...skillStyle, fetchedAt: new Date() })

  return 'recorded'
}
