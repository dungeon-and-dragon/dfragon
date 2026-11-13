import {
  type DatabaseClient,
  readClearPopulation,
  readLastFinishedJobRun,
  recordCharacterScore
} from '@dfragon/database'
import type { ScoreCalculationStore } from '../../application/character-score/ports.js'
import { CLEAR_CONTENTS, toCollectionMinFame } from '../../domain/content-clears/contents.js'

export function createDatabaseScoreCalculationStore(
  client: DatabaseClient,
  jobName: string
): ScoreCalculationStore {
  return {
    readTargets: () => readClearPopulation(client, toCollectionMinFame(CLEAR_CONTENTS)),
    readLastFinishedRun: () => readLastFinishedJobRun(client, jobName),
    recordScore: (score) => recordCharacterScore(client, score)
  }
}
