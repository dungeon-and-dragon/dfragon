import type { CharacterIdentity } from '@dfragon/server-core/domain/character-identity.js'
import type {
  NeopleCharacterSearchInput,
  NeopleCharacterSearchResult
} from '#domain/character-search/index.js'

export type SearchCharacters = (
  input: NeopleCharacterSearchInput
) => Promise<NeopleCharacterSearchResult>

export type CharacterImageUrl = (identity: CharacterIdentity) => string
