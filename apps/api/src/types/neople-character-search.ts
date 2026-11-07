export interface NeopleCharacterSearchInput {
  characterName: string
  serverId: string
  limit: number
  wordType?: 'full' | 'match'
}

export interface CharacterSearchRow {
  characterId: string
  characterName: string
  serverId: string
  serverName: string | null
  fame: number | null
  jobName: string | null
  jobGrowName: string | null
}

export interface NeopleCharacterSearchResult {
  rows: CharacterSearchRow[]
}

export interface CharacterImageCandidate extends CharacterSearchRow {
  imageUrl: string
}

export interface CharacterCandidatesResult {
  rows: CharacterImageCandidate[]
}

export interface CharacterCandidateWithAdventure extends CharacterImageCandidate {
  adventureName: string | null
}

export interface CharacterCandidatesWithAdventureResult {
  rows: CharacterCandidateWithAdventure[]
}

export interface SearchErrorBody {
  error: {
    code: string
    message: string
  }
}

export type SearchCharacters = (
  input: NeopleCharacterSearchInput
) => Promise<NeopleCharacterSearchResult>
