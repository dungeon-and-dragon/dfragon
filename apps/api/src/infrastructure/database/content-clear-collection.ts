import {
  type ClearPopulationCharacter,
  type ClearRecordBackfillProgress,
  type ClearRecordInput,
  type ContentClearCollectionProgress,
  type ContentClearInput,
  type ContentClearPopulationInput,
  type DatabaseClient,
  type StoredClearPopulation,
  finishClearRecordBackfill,
  finishContentClearCollection,
  readClearPopulation,
  readClearRecordBackfill,
  readContentClearCollection,
  readContentClearPopulations,
  recordClearRecordBackfillProgress,
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
} from '../../application/content-clears/repository.js'

export class DatabaseClearCollectionRepository implements ClearCollectionRepository {
  constructor(private readonly client: DatabaseClient) {}

  readPopulation(minMaxFame: number): Promise<ClearPopulationCharacter[]> {
    return readClearPopulation(this.client, minMaxFame)
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

  recordPopulation(population: ContentClearPopulationInput): Promise<void> {
    return recordContentClearPopulation(this.client, population)
  }

  finishProgress(startedAt: Date): Promise<void> {
    return finishContentClearCollection(this.client, startedAt)
  }
}

export class DatabaseClearRecordBackfillRepository implements ClearRecordBackfillRepository {
  constructor(private readonly client: DatabaseClient) {}

  readPopulation(minMaxFame: number): Promise<ClearPopulationCharacter[]> {
    return readClearPopulation(this.client, minMaxFame)
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

  finishProgress(startedAt: Date): Promise<void> {
    return finishClearRecordBackfill(this.client, startedAt)
  }
}
