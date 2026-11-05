import type {
  CharacterCandidatesResult,
  SearchCharacters
} from '../types/neople-character-search.js'

export interface CharacterSearchDependencies {
  readonly searchCharacters: SearchCharacters
}

export interface CharacterCandidatesResponse {
  result: CharacterCandidatesResult
  source: 'cache' | 'shared' | 'neople'
}

export interface CharacterSearchHttpService {
  search(originalUrl: string): Promise<CharacterCandidatesResult>
  candidates(originalUrl: string): Promise<CharacterCandidatesResponse>
  onModuleDestroy(): Promise<void>
}
