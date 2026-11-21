import {
  type CharacterActivityInput,
  type ClearPopulationJob,
  type ClearPopulationPage,
  type ClearPopulationSelection,
  type ClearRecordBackfillProgress,
  type ClearRecordCursor,
  type ClearRecordInput,
  type ContentClearCollectionProgress,
  type ContentClearInput,
  type ContentClearPopulationInput,
  type DatabaseClient,
  type StoredClearPopulation,
  type TimelineCharacter,
  countClearPopulation,
  finishClearRecordBackfill,
  finishContentClearCollection,
  readClearPopulationJobs,
  readClearPopulationPage,
  readClearRecordBackfill,
  readClearRecordCursors,
  readContentClearCollection,
  readContentClearPopulations,
  recordClearRecordBackfillProgress,
  recordClearRecordCursors,
  recordCharactersActive,
  recordClearRecords,
  recordContentClearCollectionProgress,
  recordContentClearPopulation,
  recordContentClears,
  startClearRecordBackfill,
  startContentClearCollection
} from '@dfragon/database'
import type {
  ClearCollectionRepository,
  ClearRecordBackfillRepository
} from '#application/content-clears/repository.js'

export class DatabaseClearCollectionRepository implements ClearCollectionRepository {
  constructor(private readonly client: DatabaseClient) {}

  countPopulation(selection: ClearPopulationSelection): Promise<number> {
    return countClearPopulation(this.client, selection)
  }

  readPopulationPage(
    selection: ClearPopulationSelection,
    page: ClearPopulationPage
  ): Promise<TimelineCharacter[]> {
    return readClearPopulationPage(this.client, selection, page)
  }

  readPopulationJobs(minMaxFame: number): Promise<ClearPopulationJob[]> {
    return readClearPopulationJobs(this.client, minMaxFame)
  }

  readPopulations(): Promise<StoredClearPopulation[]> {
    return readContentClearPopulations(this.client)
  }

  readProgress(): Promise<ContentClearCollectionProgress | undefined> {
    return readContentClearCollection(this.client)
  }

  startProgress(startedAt: Date): Promise<void> {
    return startContentClearCollection(this.client, startedAt)
  }

  recordProgress(progress: ContentClearCollectionProgress): Promise<void> {
    return recordContentClearCollectionProgress(this.client, progress)
  }

  recordClears(clears: readonly ContentClearInput[]): Promise<void> {
    return recordContentClears(this.client, clears)
  }

  recordRecords(records: readonly ClearRecordInput[]): Promise<void> {
    return recordClearRecords(this.client, records)
  }

  recordActivities(activities: readonly CharacterActivityInput[]): Promise<void> {
    return recordCharactersActive(this.client, activities)
  }

  recordPopulation(population: ContentClearPopulationInput): Promise<void> {
    return recordContentClearPopulation(this.client, population)
  }

  finishProgress(startedAt: Date): Promise<void> {
    return finishContentClearCollection(this.client, startedAt)
  }
}

export class DatabaseClearRecordBackfillRepository implements ClearRecordBackfillRepository {
  constructor(private readonly client: DatabaseClient) {}

  countPopulation(selection: ClearPopulationSelection): Promise<number> {
    return countClearPopulation(this.client, selection)
  }

  readPopulationPage(
    selection: ClearPopulationSelection,
    page: ClearPopulationPage
  ): Promise<TimelineCharacter[]> {
    return readClearPopulationPage(this.client, selection, page)
  }

  readProgress(): Promise<ClearRecordBackfillProgress | undefined> {
    return readClearRecordBackfill(this.client)
  }

  startProgress(startedAt: Date): Promise<void> {
    return startClearRecordBackfill(this.client, startedAt)
  }

  recordProgress(progress: ClearRecordBackfillProgress): Promise<void> {
    return recordClearRecordBackfillProgress(this.client, progress)
  }

  recordRecords(records: readonly ClearRecordInput[]): Promise<void> {
    return recordClearRecords(this.client, records)
  }

  readCursors(): Promise<ClearRecordCursor[]> {
    return readClearRecordCursors(this.client)
  }

  recordCursors(characters: readonly TimelineCharacter[], fetchedUntil: Date): Promise<void> {
    return recordClearRecordCursors(this.client, characters, fetchedUntil)
  }

  finishProgress(startedAt: Date): Promise<void> {
    return finishClearRecordBackfill(this.client, startedAt)
  }
}
