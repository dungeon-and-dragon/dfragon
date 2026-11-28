import type {
  CharacterActivityInput,
  ClearPopulationJob,
  ClearPopulationPage,
  ClearPopulationSelection,
  ClearRecordBackfillProgress,
  ClearRecordCursor,
  ClearRecordInput,
  ContentClearCollectionProgress,
  ContentClearInput,
  ContentClearPopulationInput,
  ContentClearSetting,
  StoredClearPopulation,
  TimelineCharacter
} from '@dfragon/database'

export interface ClearCollectionRepository {
  readSettings(): Promise<ContentClearSetting[]>
  countPopulation(selection: ClearPopulationSelection): Promise<number>
  readPopulationPage(
    selection: ClearPopulationSelection,
    page: ClearPopulationPage
  ): Promise<TimelineCharacter[]>
  readPopulationJobs(minMaxFame: number): Promise<ClearPopulationJob[]>
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
  countPopulation(selection: ClearPopulationSelection): Promise<number>
  readPopulationPage(
    selection: ClearPopulationSelection,
    page: ClearPopulationPage
  ): Promise<TimelineCharacter[]>
  readProgress(): Promise<ClearRecordBackfillProgress | undefined>
  startProgress(startedAt: Date): Promise<void>
  recordProgress(progress: ClearRecordBackfillProgress): Promise<void>
  recordRecords(records: readonly ClearRecordInput[]): Promise<void>
  readCursors(): Promise<ClearRecordCursor[]>
  recordCursors(characters: readonly TimelineCharacter[], fetchedUntil: Date): Promise<void>
  finishProgress(startedAt: Date): Promise<void>
}
