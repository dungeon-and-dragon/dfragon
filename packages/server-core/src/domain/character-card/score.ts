import type { ScoreCalculator, ScoreEngineResult, ScoreOutcome } from '#domain/score/index.js'
import type { CharacterCard, CharacterCardScore, CharacterRole } from './types.js'

export function cardScoreCalculator(role: CharacterRole | null): ScoreCalculator {
  if (role === 'buffer') {
    return 'buff'
  }

  return 'equipment'
}

function toApproximateScore(outcome: ScoreOutcome): CharacterCardScore['approximate'] {
  const { approximate_score: value, approximate_source: source, warning } = outcome
  if (value === null || source === null || warning === null) {
    return null
  }

  return { value, source, warning }
}

function cardScoreOf(result: ScoreEngineResult, outcome: ScoreOutcome): CharacterCardScore {
  const { versions } = result

  return {
    calculator: result.calculator,
    value: outcome.score,
    skipped: outcome.skipped,
    approximate: toApproximateScore(outcome),
    versions: {
      package: versions.package,
      rulesRev: versions.rules_rev,
      bundleId: versions.bundle_id
    }
  }
}

export function toCardScore(result: ScoreEngineResult): CharacterCardScore {
  return cardScoreOf(result, result)
}

export function toSimulatedCardScore(result: ScoreEngineResult): CharacterCardScore | null {
  if (result.simulation === undefined) {
    return null
  }

  return cardScoreOf(result, result.simulation)
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
