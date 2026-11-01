import { apiCharacterCardSchema } from '../../preload/common/search/character-summary'
import type {
  CharacterCard,
  CharacterCardRole,
  CharacterCardScore,
  CharacterDetails,
  CharacterScoreCalculator
} from '../../preload/common/types/character'

export type CalculateCardScore = (
  details: CharacterDetails,
  calculator: CharacterScoreCalculator
) => Promise<CharacterCardScore | null>

function scoreCalculator(role: CharacterCardRole | null): CharacterScoreCalculator {
  if (role === 'buffer') {
    return 'buff'
  }

  return 'equipment'
}

export async function buildCharacterCard(
  details: CharacterDetails,
  score: CalculateCardScore
): Promise<CharacterCard | null> {
  const parsed = apiCharacterCardSchema.safeParse(details.card)
  if (!parsed.success) {
    return null
  }
  const { role } = parsed.data
  const cardScore = await score(details, scoreCalculator(role))

  return { role, score: cardScore }
}
