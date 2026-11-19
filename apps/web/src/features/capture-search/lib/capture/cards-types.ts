import type { ServerId } from '#shared/config/servers/servers-types'
import type { CharacterCard, CharacterFaceWindow } from '#entities/character'
import type { SearchSlot } from '#features/capture-search/lib/search/search'

export type SlotState = SearchSlot['state']

export type CharacterTier = 'top' | 'ranker'

export type { CharacterCard }

export interface CardCharacter {
  characterId?: string
  name: string
  adventure: string
  guildId?: string | null
  guild?: string | null
  job: string
  serverId: ServerId
  fame: number | null
  level?: number | null
  tier?: CharacterTier
  card: CharacterCard | null
  image?: string
  face?: CharacterFaceWindow | null
}
