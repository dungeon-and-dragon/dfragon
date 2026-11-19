import type { CharacterBasicInput, CollectedCharacter, FameRefreshTarget } from '@dfragon/database'

export interface CharacterActivityRepository {
  countRefreshTargets(): Promise<number>
  readRefreshTargets(after: CollectedCharacter | null, limit: number): Promise<FameRefreshTarget[]>
  countInactive(): Promise<number>
  readInactive(after: CollectedCharacter | null, limit: number): Promise<CollectedCharacter[]>
  recordActive(character: CollectedCharacter, lastActiveAt: Date): Promise<void>
  recordInactive(character: CollectedCharacter, inactiveSince: Date): Promise<void>
  recordBasic(basic: CharacterBasicInput): Promise<void>
}
