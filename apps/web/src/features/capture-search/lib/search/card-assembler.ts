import {
  apiCharacterCardSchema,
  type CharacterCard,
  type CharacterDetails
} from '#entities/character'

export function buildCharacterCard(details: CharacterDetails): CharacterCard | null {
  const parsed = apiCharacterCardSchema.safeParse(details.card)
  if (!parsed.success) {
    return null
  }

  return parsed.data
}
