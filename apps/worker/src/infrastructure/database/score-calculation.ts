import {
  type CharacterBasicInput,
  type CharacterHistoryInput,
  type CharacterScoreInput,
  type CharacterSetsInput,
  type ClearPopulationCharacter,
  type DatabaseClient,
  type FinishedJobRun,
  readClearPopulation,
  readLastFinishedJobRun,
  recordCharacterBasic,
  recordCharacterHistory,
  recordCharacterScore,
  recordCharacterSets
} from '@dfragon/database'
import type { ScoreCalculationRepository } from '#application/character-score/repository.js'
import {
  CLEAR_CONTENTS,
  toCollectionMinFame
} from '@dfragon/server-core/domain/content-clears/index.js'

export class DatabaseScoreCalculationRepository implements ScoreCalculationRepository {
  constructor(
    private readonly client: DatabaseClient,
    private readonly jobName: string
  ) {}

  readTargets(): Promise<ClearPopulationCharacter[]> {
    return readClearPopulation(this.client, toCollectionMinFame(CLEAR_CONTENTS))
  }

  readLastFinishedRun(): Promise<FinishedJobRun | undefined> {
    return readLastFinishedJobRun(this.client, this.jobName)
  }

  recordScore(score: CharacterScoreInput): Promise<void> {
    return recordCharacterScore(this.client, score)
  }

  recordBasic(basic: CharacterBasicInput): Promise<void> {
    return recordCharacterBasic(this.client, basic)
  }

  recordHistory(history: CharacterHistoryInput): Promise<void> {
    return recordCharacterHistory(this.client, history)
  }

  recordSets(sets: CharacterSetsInput): Promise<void> {
    return recordCharacterSets(this.client, sets)
  }
}
