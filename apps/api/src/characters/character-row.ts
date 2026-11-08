import type { StoredCharacter } from '@dfragon/database'
import type { CharacterRole } from './domain/character.js'
import { characterFromStored } from './domain/from-details.js'

export type CharacterRow = Omit<StoredCharacter, 'dealerSkillLearned'> & {
  role: CharacterRole | null
}

export function toCharacterRow(stored: StoredCharacter): CharacterRow {
  const { dealerSkillLearned, ...row } = stored
  const role = characterFromStored(stored)?.role() ?? null

  return { ...row, role }
}
