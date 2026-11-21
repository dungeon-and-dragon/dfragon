import type {
  CharacterActivityInput,
  ClearPopulationCharacter,
  ClearRecordBackfillProgress,
  ClearRecordCursor,
  ClearRecordInput,
  ContentClearCollectionProgress,
  ContentClearInput,
  ContentClearPopulationInput,
  PopulationActivity,
  StoredClearPopulation
} from '@dfragon/database'

export interface ClearCollectionRepository {
  readPopulation(
    minMaxFame: number,
    activity: PopulationActivity
  ): Promise<ClearPopulationCharacter[]>
  readPopulations(): Promise<StoredClearPopulation[]>
  readProgress(): Promise<ContentClearCollectionProgress | undefined>
  startProgress(startedAt: Date): Promise<void>
  recordProgress(progress: ContentClearCollectionProgress): Promise<void>
  recordClears(clears: readonly ContentClearInput[]): Promise<void>
  recordRecords(records: readonly ClearRecordInput[]): Promise<void>
  recordActivities(activities: readonly CharacterActivityInput[]): Promise<void>
  recordPopulation(population: ContentClearPopulationInput): Promise<void>
  finishProgress(startedAt: Date): Promise<void>
}

export interface ClearRecordBackfillRepository {
  readPopulation(
    minMaxFame: number,
    activity: PopulationActivity
  ): Promise<ClearPopulationCharacter[]>
  readProgress(): Promise<ClearRecordBackfillProgress | undefined>
  startProgress(startedAt: Date): Promise<void>
  recordProgress(progress: ClearRecordBackfillProgress): Promise<void>
  recordRecords(records: readonly ClearRecordInput[]): Promise<void>
  readCursors(): Promise<ClearRecordCursor[]>
  recordCursors(characters: readonly ClearPopulationCharacter[], fetchedUntil: Date): Promise<void>
  finishProgress(startedAt: Date): Promise<void>
}
