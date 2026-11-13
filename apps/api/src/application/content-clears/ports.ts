import type {
  ClearCoClearCount,
  ClearFameSample,
  ClearJobFameSample,
  ClearPopulationCharacter,
  ClearRaidTimeCount,
  ClearRecordInput,
  ContentClearCollectionProgress,
  ContentClearInput,
  ContentClearPopulationInput,
  StoredClearPopulation,
  ClearAdventureSize,
  ClearJobCount,
  ClearWeekRatioCount,
  ClearWeekSelection
} from '@dfragon/database'
import type { FetchCharacterTimeline } from '../character-timeline/ports.js'

export type CreateClearTimeline = (onRequest: () => void) => FetchCharacterTimeline

export type ClearCollectionStore = {
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

export type ClearCollectionDependencies = {
  store: ClearCollectionStore
  createFetchTimeline: CreateClearTimeline
  readConcurrency: () => number
  now: () => Date
  pause: (ms: number) => Promise<void>
  report: (code: string, details: Readonly<Record<string, string | number>>) => void
  reportProgress: (done: number, total: number) => void
}

export type ClearCollectionJobDependencies = Pick<
  ClearCollectionDependencies,
  'createFetchTimeline' | 'readConcurrency' | 'report'
>

export interface ClearStatsReader {
  readCollectedAt(): Promise<Date | null>
  readPopulations(): Promise<StoredClearPopulation[]>
  readWeekRatioCounts(): Promise<ClearWeekRatioCount[]>
  readJobCounts(selection: ClearWeekSelection): Promise<ClearJobCount[]>
  readAdventureSizes(selection: ClearWeekSelection): Promise<ClearAdventureSize[]>
  readFames(weekStart: Date): Promise<ClearFameSample[]>
  readJobFames(weekStart: Date): Promise<ClearJobFameSample[]>
  readCoClears(weekStart: Date): Promise<ClearCoClearCount[]>
  readRaidTimes(weekStart: Date): Promise<ClearRaidTimeCount[]>
}
