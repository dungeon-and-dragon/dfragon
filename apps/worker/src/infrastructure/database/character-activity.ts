import {
  type CharacterBasicInput,
  type CollectedCharacter,
  type DatabaseClient,
  type FameRefreshTarget,
  countFameRefreshTargets,
  countInactiveCharacters,
  readFameRefreshTargets,
  readInactiveCharacters,
  recordCharacterActive,
  recordCharacterBasic,
  recordCharacterInactive
} from '@dfragon/database'
import type { CharacterActivityRepository } from '#application/character-activity/repository.js'

export class DatabaseCharacterActivityRepository implements CharacterActivityRepository {
  constructor(private readonly client: DatabaseClient) {}

  countRefreshTargets(): Promise<number> {
    return countFameRefreshTargets(this.client)
  }

  readRefreshTargets(
    after: CollectedCharacter | null,
    limit: number
  ): Promise<FameRefreshTarget[]> {
    return readFameRefreshTargets(this.client, after, limit)
  }

  countInactive(): Promise<number> {
    return countInactiveCharacters(this.client)
  }

  readInactive(after: CollectedCharacter | null, limit: number): Promise<CollectedCharacter[]> {
    return readInactiveCharacters(this.client, after, limit)
  }

  recordActive(character: CollectedCharacter, lastActiveAt: Date): Promise<void> {
    return recordCharacterActive(this.client, character, lastActiveAt)
  }

  recordInactive(character: CollectedCharacter, inactiveSince: Date): Promise<void> {
    return recordCharacterInactive(this.client, character, inactiveSince)
  }

  recordBasic(basic: CharacterBasicInput): Promise<void> {
    return recordCharacterBasic(this.client, basic)
  }
}
