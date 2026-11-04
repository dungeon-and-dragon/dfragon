import { characterFromDetails } from '../domain/from-details.js'
import type { CharacterCard } from './types.js'

export interface CharacterCardSource {
  character: Record<string, unknown>
  skillStyle: unknown
}

export function projectCharacterCard({
  character,
  skillStyle
}: CharacterCardSource): CharacterCard {
  const role = characterFromDetails(character, skillStyle)?.role() ?? null

  return { role, stats: null, score: null, serverRank: null, set: null, oath: null, investment: [] }
}
