import type { CharacterScoreApproximation, CharacterScoreInput } from '@dfragon/database'
import type { ScoreEngineResult } from './result.js'

export type CalculatedScore = Omit<CharacterScoreInput, 'serverId' | 'characterId' | 'job'>

type StoredScoreValue = Pick<CalculatedScore, 'score' | 'approximate'>

function toStoredScoreValue(result: ScoreEngineResult): StoredScoreValue | null {
  if (result.score !== null) {
    return { score: result.score, approximate: null }
  }

  const { approximate_score: value, approximate_source: source, warning, skipped } = result

  if (value === null || source === null || warning === null || skipped === null) {
    return null
  }

  const approximate: CharacterScoreApproximation = { source, warning, skipped }

  return { score: value, approximate }
}

/** 점수도 근사값도 내지 못한 결과는 저장할 점수가 아니다. */
export function toCalculatedScore(
  result: ScoreEngineResult | null,
  calculatedAt: Date
): CalculatedScore | null {
  if (result === null) {
    return null
  }

  const value = toStoredScoreValue(result)

  if (value === null) {
    return null
  }

  const { versions } = result

  return {
    kind: result.calculator,
    ...value,
    calculatedAt,
    engine: {
      package: versions.package,
      rulesRev: versions.rules_rev,
      bundleId: versions.bundle_id
    }
  }
}
