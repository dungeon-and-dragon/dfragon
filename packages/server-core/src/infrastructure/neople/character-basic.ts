import { characterBasicSchema, characterSkillStyleSchema } from '@dfragon/neople'
import type {
  ParseCharacterBasic,
  ParseCharacterSkillStyle
} from '../../application/character-basic/ports.js'

export const parseCharacterBasic: ParseCharacterBasic = (payload) => {
  const parsed = characterBasicSchema.safeParse(payload)
  if (!parsed.success) {
    return undefined
  }

  return parsed.data
}

export const parseCharacterSkillStyle: ParseCharacterSkillStyle = (payload) => {
  const parsed = characterSkillStyleSchema.safeParse(payload)
  if (!parsed.success) {
    return undefined
  }

  return parsed.data
}
