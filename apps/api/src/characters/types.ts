import type { StoredAdventureName } from '@dfragon/database'
import type {
  CharacterCandidatesWithAdventureResult,
  CharacterCandidatesResult,
  SearchCharacters
} from '../types/neople-character-search.js'

export type ReadAdventureNames = (
  characters: readonly { serverId: string; characterId: string }[]
) => Promise<StoredAdventureName[]>

export interface CharacterSearchDependencies {
  readonly searchCharacters: SearchCharacters
  readonly readAdventureNames?: ReadAdventureNames
}

export type CandidateSource = 'cache' | 'shared' | 'neople'

export interface CharacterCandidatesResponse {
  result: CharacterCandidatesWithAdventureResult
  source: CandidateSource
}

export interface CharacterSearchHttpService {
  search(originalUrl: string): Promise<CharacterCandidatesResult>
  candidates(originalUrl: string): Promise<CharacterCandidatesResponse>
  onModuleDestroy(): Promise<void>
}
