import type { StoredCharacter, StoredCharacterScore } from '@dfragon/database'
import type { CharacterCardScore } from '@dfragon/server-core/domain/character-card/index.js'
import type { CharacterRole } from '@dfragon/server-core/domain/character-role.js'
import { characterFromStored } from '@dfragon/server-core/domain/character-from-details.js'

export type CharacterRowScore = Pick<CharacterCardScore, 'calculator'> & {
  value: number
  approximate: { source: string } | null
}

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
  score: CharacterRowScore | null
}

export function toCharacterRowScore(stored: StoredCharacterScore | null): CharacterRowScore | null {
  if (stored === null) {
    return null
  }

  const { kind: calculator, value, approximateSource } = stored
  const approximate = approximateSource !== null ? { source: approximateSource } : null

  return { calculator, value, approximate }
}

export function toCharacterRow(stored: StoredCharacter): CharacterRow {
  const { dealerSkillLearned, score: storedScore, ...row } = stored
  const role = characterFromStored(stored)?.role() ?? null
  const score = toCharacterRowScore(storedScore)

  return { ...row, role, score }
}
