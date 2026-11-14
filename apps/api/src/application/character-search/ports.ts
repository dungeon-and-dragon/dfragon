import type { CharacterIdentity } from '../../domain/character-identity.js'
import type {
  NeopleCharacterSearchInput,
  NeopleCharacterSearchResult
} from '../../domain/character-search/types.js'

export type SearchCharacters = (
  input: NeopleCharacterSearchInput
) => Promise<NeopleCharacterSearchResult>

export type CharacterImageUrl = (identity: CharacterIdentity) => string
