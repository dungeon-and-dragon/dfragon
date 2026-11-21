import {
  type ClearPopulationCharacter,
  type ClearRecordBackfillProgress,
  type ClearRecordCursor,
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
  readClearRecordCursors,
  readContentClearCollection,
  readContentClearPopulations,
  recordClearRecordBackfillProgress,
  recordClearRecordCursors,
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

  // 모집단이 클리어 비율의 분모이고, 월말 재확인 전에 다시 접속한 비활성 캐릭터의 클리어도 세야 하므로 비활성도 부른다.
  readPopulation(minMaxFame: number): Promise<ClearPopulationCharacter[]> {
    return readClearPopulation(this.client, minMaxFame, 'include-inactive')
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

  // 지금은 비활성인 캐릭터도 지난 시즌의 클리어 기록이 있으므로 비활성도 부른다.
  readPopulation(minMaxFame: number): Promise<ClearPopulationCharacter[]> {
    return readClearPopulation(this.client, minMaxFame, 'include-inactive')
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

  recordCursors(
    characters: readonly ClearPopulationCharacter[],
    fetchedUntil: Date
  ): Promise<void> {
    return recordClearRecordCursors(this.client, characters, fetchedUntil)
  }

  finishProgress(startedAt: Date): Promise<void> {
    return finishClearRecordBackfill(this.client, startedAt)
  }
}
