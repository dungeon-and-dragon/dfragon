import {
  type DatabaseClient,
  finishContentClearCollection,
  readClearPopulation,
  readContentClearCollection,
  readContentClearPopulations,
  recordClearRecords,
  recordContentClearCollectionProgress,
  recordContentClearPopulation,
  recordContentClears,
  startContentClearCollection
} from '@dfragon/database'
import type { ClearCollectionStore } from '../../application/content-clears/ports.js'

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
