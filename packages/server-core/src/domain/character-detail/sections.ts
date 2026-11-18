import type { NeopleCharacterSection } from '@dfragon/neople'

export type CharacterDetailSection = NeopleCharacterSection

// @dfragon/neople의 NEOPLE_CHARACTER_SECTIONS와 같은 섹션, 같은 순서다. Record 타입이 섹션이 빠지거나 더해지면 막고,
// 섹션 요청과 상세 응답 sections의 key가 이 순서를 따른다.
const sectionOrder: Record<CharacterDetailSection, true> = {
  basic: true,
  status: true,
  equipment: true,
  avatar: true,
  creature: true,
  oath: true,
  mist_assimilation: true,
  skill_style: true,
  buff_equipment: true,
  buff_avatar: true,
  buff_creature: true
}

export const characterDetailSections = Object.keys(sectionOrder) as CharacterDetailSection[]

export type { CharacterIdentity } from '../character-identity.js'

export type CharacterPayload = Record<string, unknown>

export type CharacterPayloads = Record<CharacterDetailSection, CharacterPayload>

export interface FetchedCharacterPayloads {
  payloads: CharacterPayloads
  fetchedAt: Date
}
