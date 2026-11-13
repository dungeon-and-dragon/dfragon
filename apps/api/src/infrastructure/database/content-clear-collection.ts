import {
  type DatabaseClient,
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
  ClearCollectionStore,
  ClearRecordBackfillStore
} from '../../application/content-clears/ports.js'

export function createDatabaseClearCollectionStore(client: DatabaseClient): ClearCollectionStore {
  return {
    readPopulation: (minMaxFame) => readClearPopulation(client, minMaxFame),
    readPopulations: () => readContentClearPopulations(client),
    readProgress: () => readContentClearCollection(client),
    startProgress: (startedAt) => startContentClearCollection(client, startedAt),
    recordProgress: (progress) => recordContentClearCollectionProgress(client, progress),
    recordClears: (clears) => recordContentClears(client, clears),
    recordRecords: (records) => recordClearRecords(client, records),
    recordPopulation: (population) => recordContentClearPopulation(client, population),
    finishProgress: (startedAt) => finishContentClearCollection(client, startedAt)
  }
}

export function createDatabaseClearRecordBackfillStore(
  client: DatabaseClient
): ClearRecordBackfillStore {
  return {
    readPopulation: (minMaxFame) => readClearPopulation(client, minMaxFame),
    readProgress: () => readClearRecordBackfill(client),
    startProgress: (startedAt) => startClearRecordBackfill(client, startedAt),
    recordProgress: (progress) => recordClearRecordBackfillProgress(client, progress),
    recordRecords: (records) => recordClearRecords(client, records),
    finishProgress: (startedAt) => finishClearRecordBackfill(client, startedAt)
  }
}
