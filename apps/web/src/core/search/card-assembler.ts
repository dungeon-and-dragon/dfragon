import { apiCharacterCardSchema } from '#core/character/character-summary'
import type { CharacterCard, CharacterDetails } from '#core/character/character'

export function buildCharacterCard(details: CharacterDetails): CharacterCard | null {
  const parsed = apiCharacterCardSchema.safeParse(details.card)
  if (!parsed.success) {
    return null
  }

  return parsed.data
}
