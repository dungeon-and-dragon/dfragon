import type { CharacterScoreInput } from '@dfragon/database'
import type { ScoreEngineResult } from './result.js'

export type CalculatedScore = Omit<CharacterScoreInput, 'serverId' | 'characterId'>

/** 근사값만 낸 결과처럼 점수가 없는 결과는 저장할 점수가 아니다. */
export function toCalculatedScore(
  result: ScoreEngineResult | null,
  calculatedAt: Date
): CalculatedScore | null {
  if (result === null || result.score === null) {
    return null
  }
  const { versions } = result

  return {
    kind: result.calculator,
    score: result.score,
    calculatedAt,
    engine: {
      package: versions.package,
      rulesRev: versions.rules_rev,
      bundleId: versions.bundle_id
    }
  }
}
