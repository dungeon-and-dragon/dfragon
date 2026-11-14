import {
  type CharacterScoreInput,
  type ClearPopulationCharacter,
  type DatabaseClient,
  type FinishedJobRun,
  readClearPopulation,
  readLastFinishedJobRun,
  recordCharacterScore
} from '@dfragon/database'
import type { ScoreCalculationRepository } from '../../application/character-score/repository.js'
import { CLEAR_CONTENTS, toCollectionMinFame } from '../../domain/content-clears/contents.js'

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
}
