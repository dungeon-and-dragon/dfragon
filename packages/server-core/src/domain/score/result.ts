import type { ScoreCalculator } from './input.js'

export interface ScoreEngineResult {
  calculator: ScoreCalculator
  score: number | null
  skipped: { kind: string; message: string } | null
  approximate_score: number | null
  approximate_source: string | null
  warning: string | null
  versions: { package: string; rules_rev: string; bundle_id: string }
  display: {
    role: 'dealer' | 'buffer'
    switchingLevel: number | null
    buff30: number | null
    buff50: number | null
  }
}
