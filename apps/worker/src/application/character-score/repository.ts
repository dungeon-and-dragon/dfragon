import type {
  CharacterBasicInput,
  CharacterHistoryInput,
  CharacterScoreInput,
  CharacterSetsInput,
  ClearPopulationCharacter,
  FinishedJobRun
} from '@dfragon/database'

export interface ScoreCalculationRepository {
  readTargets(minFame: number): Promise<ClearPopulationCharacter[]>
  readLastFinishedRun(): Promise<FinishedJobRun | undefined>
  recordScore(score: CharacterScoreInput): Promise<void>
  recordBasic(basic: CharacterBasicInput): Promise<void>
  recordHistory(history: CharacterHistoryInput): Promise<void>
  recordSets(sets: CharacterSetsInput): Promise<void>
}
