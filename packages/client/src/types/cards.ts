import type { ServerId } from './servers'
import type {
  CharacterFaceWindow,
  SearchSlot
} from '@dfragon/client-core/preload/common/types/search'
import type { CharacterCard } from '@dfragon/client-core/preload/common/types/character'

export type SlotState = SearchSlot['state']

export type CharacterTier = 'top' | 'ranker'

export type { CharacterCard }

export interface CardCharacter {
  characterId?: string
  name: string
  adventure: string
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
