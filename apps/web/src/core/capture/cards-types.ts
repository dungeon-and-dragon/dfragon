import type { ServerId } from '../servers/servers-types'
import type { CharacterFaceWindow, SearchSlot } from '../search/search'
import type { CharacterCard } from '../character/character'

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
