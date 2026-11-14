import type {
  ClearPopulationCharacter,
  ClearRecordBackfillProgress,
  ClearRecordInput,
  ContentClearCollectionProgress,
  ContentClearInput,
  ContentClearPopulationInput,
  StoredClearPopulation
} from '@dfragon/database'

export interface ClearCollectionRepository {
  readPopulation(minMaxFame: number): Promise<ClearPopulationCharacter[]>
  readPopulations(): Promise<StoredClearPopulation[]>
  readProgress(): Promise<ContentClearCollectionProgress | undefined>
  startProgress(startedAt: Date): Promise<void>
  recordProgress(progress: ContentClearCollectionProgress): Promise<void>
  recordClears(clears: readonly ContentClearInput[]): Promise<void>
  recordRecords(records: readonly ClearRecordInput[]): Promise<void>
  recordPopulation(population: ContentClearPopulationInput): Promise<void>
  finishProgress(startedAt: Date): Promise<void>
}

export interface ClearRecordBackfillRepository {
  readPopulation(minMaxFame: number): Promise<ClearPopulationCharacter[]>
  readProgress(): Promise<ClearRecordBackfillProgress | undefined>
  startProgress(startedAt: Date): Promise<void>
  recordProgress(progress: ClearRecordBackfillProgress): Promise<void>
  recordRecords(records: readonly ClearRecordInput[]): Promise<void>
  finishProgress(startedAt: Date): Promise<void>
}
