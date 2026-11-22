import type { ScoreCalculator } from './input.js'

export type ScoreMainStat = '힘' | '지능' | '체력' | '정신력'

export interface ScoreOutcome {
  score: number | null
  skipped: { kind: string; message: string } | null
  approximate_score: number | null
  approximate_source: string | null
  warning: string | null
}

/** 입력에 `simulation`이 있을 때만 온다. 최상위 칸은 그대로 원본 점수다. */
export interface ScoreSimulationResult extends ScoreOutcome {
  display: { buff30: number | null; buff50: number | null }
}

export interface ScoreEngineResult extends ScoreOutcome {
  calculator: ScoreCalculator
  versions: { package: string; rules_rev: string; bundle_id: string }
  display: {
    role: 'dealer' | 'buffer'
    switchingLevel: number | null
    buff30: number | null
    buff50: number | null
    mainStat?: ScoreMainStat
  }
  simulation?: ScoreSimulationResult
}
