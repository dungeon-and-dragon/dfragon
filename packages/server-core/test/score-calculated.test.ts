import assert from 'node:assert/strict'
import test from 'node:test'
import { toCalculatedScore } from '../src/domain/score/calculated.js'
import type { ScoreEngineResult } from '../src/domain/score/result.js'

const calculatedAt = new Date('2026-11-22T00:00:00.000Z')
const exactResult: ScoreEngineResult = {
  calculator: 'equipment',
  score: 1741,
  skipped: null,
  approximate_score: null,
  approximate_source: null,
  warning: null,
  versions: { package: 'dnfscore-native 0.4.2', rules_rev: 'rev14', bundle_id: 'phase32-rev14d' },
  display: { role: 'dealer', switchingLevel: 3, buff30: null, buff50: null }
}
const skippedResult: ScoreEngineResult = {
  ...exactResult,
  score: null,
  skipped: { kind: 'resolution', message: '판정 불가' }
}
const approximateResult: ScoreEngineResult = {
  ...skippedResult,
  approximate_score: 1650,
  approximate_source: 'legacy_fusion_policy_a',
  warning: '근사값, 1% 밖일 가능성 높음: 판정 불가'
}
const engine = { package: 'dnfscore-native 0.4.2', rulesRev: 'rev14', bundleId: 'phase32-rev14d' }

test('정확한 점수는 근사 정보 없이 저장할 점수로 바꾼다', () => {
  assert.deepEqual(toCalculatedScore(exactResult, calculatedAt), {
    kind: 'equipment',
    score: 1741,
    approximate: null,
    calculatedAt,
    engine
  })
})

test('점수 없이 근사값만 낸 결과는 근사값을 점수로 두고 근사 방식, 경고, 건너뛴 이유를 함께 저장한다', () => {
  assert.deepEqual(toCalculatedScore(approximateResult, calculatedAt), {
    kind: 'equipment',
    score: 1650,
    approximate: {
      source: 'legacy_fusion_policy_a',
      warning: '근사값, 1% 밖일 가능성 높음: 판정 불가',
      skipped: { kind: 'resolution', message: '판정 불가' }
    },
    calculatedAt,
    engine
  })
})

test('점수도 근사값도 없거나 근사 정보가 하나라도 빠진 결과, 결과가 없는 계산은 저장하지 않는다', () => {
  const cases: [string, ScoreEngineResult | null][] = [
    ['결과 없음', null],
    ['근사값 없이 건너뜀', skippedResult],
    ['근사 방식 없음', { ...approximateResult, approximate_source: null }],
    ['경고 없음', { ...approximateResult, warning: null }],
    ['건너뛴 이유 없음', { ...approximateResult, skipped: null }]
  ]

  for (const [name, result] of cases) {
    assert.equal(toCalculatedScore(result, calculatedAt), null, name)
  }
})
