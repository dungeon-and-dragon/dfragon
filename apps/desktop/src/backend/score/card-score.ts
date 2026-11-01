import type { CharacterCardScore } from '../../preload/common/types/character'
import type { CharacterCardScorer } from '../../shared/search/request'
import type { ScoreEngine, ScoreEngineResult } from './engine'
import { toScoreEngineInput } from './input'

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

export function createEngineCardScorer(engine: ScoreEngine): CharacterCardScorer {
  return {
    calculate: async (details, calculator, signal) => {
      const result = await engine.calculate(toScoreEngineInput(details), calculator, signal)
      if (result === null) {
        return null
      }

      return toCardScore(result)
    },
    prepare: () => engine.prepare()
  }
}
