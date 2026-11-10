import type { StoredCharacter } from '@dfragon/database'
import type { CharacterRole } from './character-role.js'
import { characterFromStored } from './character-from-details.js'

export type CharacterRow = Omit<StoredCharacter, 'dealerSkillLearned'> & {
  role: CharacterRole | null
}

export function toCharacterRow(stored: StoredCharacter): CharacterRow {
  const { dealerSkillLearned, ...row } = stored
  const role = characterFromStored(stored)?.role() ?? null

  return { ...row, role }
}
