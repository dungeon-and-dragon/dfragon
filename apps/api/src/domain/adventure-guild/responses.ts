import type { StoredCharacter } from '@dfragon/database'
import type { CharacterRow } from '../character-row.js'
import type { AdventureWeeklyClears } from './weekly.js'

export type AdventureCharacters = {
  adventureName: string
  characters: CharacterRow[]
}

export type AdventureWeekly = AdventureWeeklyClears & { adventureName: string }

export type GuildMembers = {
  guildId: string
  guildName: string | null
  memberCount: number
  averageFame: number | null
  members: CharacterRow[]
}

export function averageFame(members: readonly StoredCharacter[]): number | null {
  const fames = members.map(({ fame }) => fame).filter((fame) => fame !== null)
  if (fames.length === 0) {
    return null
  }

  return Math.round(fames.reduce((sum, fame) => sum + fame, 0) / fames.length)
}
