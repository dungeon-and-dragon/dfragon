import type { ScoreEngineResult } from '../../score/engine.js'
import type { ScoreCalculator } from '../../score/input.js'
import type { CharacterCard, CharacterCardScore, CharacterRole } from './types.js'

export function cardScoreCalculator(role: CharacterRole | null): ScoreCalculator {
  if (role === 'buffer') {
    return 'buff'
  }

  return 'equipment'
}

function toApproximateScore(result: ScoreEngineResult): CharacterCardScore['approximate'] {
  const { approximate_score: value, approximate_source: source, warning } = result
  if (value === null || source === null || warning === null) {
    return null
  }

  return { value, source, warning }
}

function toCardScore(result: ScoreEngineResult): CharacterCardScore {
  const { versions } = result

  return {
    calculator: result.calculator,
    value: result.score,
    skipped: result.skipped,
    approximate: toApproximateScore(result),
    versions: {
      package: versions.package,
      rulesRev: versions.rules_rev,
      bundleId: versions.bundle_id
    }
  }
}

export function withCardScore(
  card: CharacterCard,
  result: ScoreEngineResult | null
): CharacterCard {
  if (result === null) {
    return card
  }

  return { ...card, score: toCardScore(result) }
}
