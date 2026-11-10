import type { StoredCharacter } from '@dfragon/database'
import type { CharacterRole } from './character-role.js'
import { characterFromStored } from './character-from-details.js'

export type CharacterRow = {
  serverId: string
  characterId: string
  characterName: string
  adventureName: string
  level: number | null
  jobId: string | null
  jobGrowId: string | null
  jobName: string | null
  jobGrowName: string | null
  fame: number | null
  guildId: string | null
  guildName: string | null
  fetchedAt: Date | null
  role: CharacterRole | null
}

export function toCharacterRow(stored: StoredCharacter): CharacterRow {
  const { dealerSkillLearned, ...row } = stored
  const role = characterFromStored(stored)?.role() ?? null

  return { ...row, role }
}
