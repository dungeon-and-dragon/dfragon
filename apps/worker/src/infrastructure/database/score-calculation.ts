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

export class DatabaseScoreCalculationRepository implements ScoreCalculationRepository {
  constructor(
    private readonly client: DatabaseClient,
    private readonly jobName: string
  ) {}

  // 비활성 캐릭터는 30일 동안 접속하지 않아 장비가 지난 계산과 같으므로 상세를 다시 받지 않는다.
  readTargets(minFame: number): Promise<ClearPopulationCharacter[]> {
    return readClearPopulation(this.client, minFame, 'active-only')
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
