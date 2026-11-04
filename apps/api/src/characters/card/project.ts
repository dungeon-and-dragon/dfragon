import { characterJob } from '../job/from-character.js'
import type { CharacterCard } from './types.js'

export interface CharacterCardSource {
  character: Record<string, unknown>
  skillStyle: unknown
}

export function projectCharacterCard({
  character,
  skillStyle
}: CharacterCardSource): CharacterCard {
  const role = characterJob(character, skillStyle)?.role() ?? null

  return { role, stats: null, score: null, serverRank: null, set: null, oath: null, investment: [] }
}
