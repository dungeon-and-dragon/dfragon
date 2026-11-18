import type { ScoreCalculator, ScoreEngineInput } from '../../domain/score/input.js'

export type ScoreWorkerData = Readonly<{ path: string }>
export type ScoreWorkerRequest = Readonly<{
  id: number
  input: ScoreEngineInput
  calculator: ScoreCalculator
}>
export type ScoreWorkerMessage =
  | Readonly<{ kind: 'unavailable' }>
  | Readonly<{ kind: 'result'; id: number; text: string | null }>
