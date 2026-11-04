import type { ScoreCalculator } from '../../score/input.js'
import type { CharacterRole } from '../domain/character.js'

export type { CharacterRole }

export interface CharacterCardScore {
  calculator: ScoreCalculator
  value: number | null
  skipped: { kind: string; message: string } | null
  approximate: { value: number; source: string; warning: string } | null
  versions: { package: string; rulesRev: string; bundleId: string }
}

/**
 * The retired stats, rank, set, oath and investment fields stay as empty values so the response shape
 * does not change; released Desktop builds read only `role` from the card.
 */
export interface CharacterCard {
  role: CharacterRole | null
  stats: null
  score: CharacterCardScore | null
  serverRank: null
  set: null
  oath: null
  investment: []
}
