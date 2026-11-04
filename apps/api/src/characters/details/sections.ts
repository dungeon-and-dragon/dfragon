import { NEOPLE_CHARACTER_SECTIONS, type NeopleCharacterSection } from '@dfragon/neople'

export type CharacterDetailSection = NeopleCharacterSection
export const characterDetailSections = Object.keys(
  NEOPLE_CHARACTER_SECTIONS
) as CharacterDetailSection[]

export type { CharacterIdentity } from '../identity.js'

export type CharacterPayload = Record<string, unknown>

export type CharacterPayloads = Record<CharacterDetailSection, CharacterPayload>

export interface FetchedCharacterPayloads {
  payloads: CharacterPayloads
  fetchedAt: Date
}
