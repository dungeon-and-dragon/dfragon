import type { ScoreCalculator } from '../score/input.js'
import type { CharacterRole } from '../character-role.js'

export type { CharacterRole }

export interface CharacterCardScore {
  calculator: ScoreCalculator
  value: number | null
  skipped: { kind: string; message: string } | null
  approximate: { value: number; source: string; warning: string } | null
  versions: { package: string; rulesRev: string; bundleId: string }
}

export interface CharacterCard {
  role: CharacterRole | null
  score: CharacterCardScore | null
}
