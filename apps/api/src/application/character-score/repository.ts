import type {
  CharacterScoreInput,
  ClearPopulationCharacter,
  FinishedJobRun
} from '@dfragon/database'

export interface ScoreCalculationRepository {
  readTargets(): Promise<ClearPopulationCharacter[]>
  readLastFinishedRun(): Promise<FinishedJobRun | undefined>
  recordScore(score: CharacterScoreInput): Promise<void>
}
