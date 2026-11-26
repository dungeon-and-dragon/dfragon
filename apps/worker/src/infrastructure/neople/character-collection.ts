import { type NeopleClient, NeopleRequestFailure } from '@dfragon/neople'
import type { FetchCharacterBasic } from '#application/character-collection/ports.js'
import { CharacterCollectionFailure } from '#domain/character-collection/index.js'

export type WorkerNeople = Pick<
  NeopleClient,
  | 'auction'
  | 'character'
  | 'characterBasic'
  | 'characterSkillStyle'
  | 'characterTimeline'
  | 'charactersFame'
  | 'jobs'
  | 'multiItems'
  | 'searchItems'
  | 'servers'
>

export function createNeopleCharacterBasic(
  neople: Pick<NeopleClient, 'characterBasic'>
): FetchCharacterBasic {
  return async (character) => {
    try {
      return await neople.characterBasic(character)
    } catch (error) {
      if (error instanceof NeopleRequestFailure) {
        throw new CharacterCollectionFailure(error.kind)
      }
      throw error
    }
  }
}
