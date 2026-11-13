import type {
  ClearCoClearCount,
  ClearFameBandCount,
  ClearFameSample,
  ClearFirstWeekCount,
  ClearJobFameSample,
  ClearPopulationCharacter,
  ClearRecordBackfillProgress,
  ClearRecordInput,
  ClearStageMoveCount,
  ClearStageMoveSelection,
  ClearStreakCount,
  ClearTimeCount,
  ContentClearCollectionProgress,
  ContentClearInput,
  ContentClearPopulationInput,
  StoredClearPopulation,
  ClearAdventureSize,
  ClearWeekComparison,
  ClearWeekGroupSample,
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

export type ClearRecordBackfillStore = {
  readPopulation(minMaxFame: number): Promise<ClearPopulationCharacter[]>
  readProgress(): Promise<ClearRecordBackfillProgress | undefined>
  startProgress(startedAt: Date): Promise<void>
  recordProgress(progress: ClearRecordBackfillProgress): Promise<void>
  recordRecords(records: readonly ClearRecordInput[]): Promise<void>
  finishProgress(startedAt: Date): Promise<void>
}

export type ClearRecordBackfillDependencies = Omit<ClearCollectionDependencies, 'store'> & {
  store: ClearRecordBackfillStore
}

export type ClearRecordBackfillJobDependencies = {
  createFetchRecordTimeline: CreateClearTimeline
  readConcurrency: () => number
  report: ClearCollectionDependencies['report']
}

export interface ClearStatsReader {
  readCollectedAt(): Promise<Date | null>
  readPopulations(): Promise<StoredClearPopulation[]>
  readWeekRatioCounts(): Promise<ClearWeekRatioCount[]>
  readAdventureSizes(selection: ClearWeekSelection): Promise<ClearAdventureSize[]>
  readContentJobFames(selection: ClearWeekSelection): Promise<ClearJobFameSample[]>
  readContentTimes(selection: ClearWeekSelection): Promise<ClearTimeCount[]>
  readFirstWeeks(contentId: string): Promise<ClearFirstWeekCount[]>
  readFameBands(selection: ClearWeekSelection, minFame: number): Promise<ClearFameBandCount[]>
  readWeekGroups(comparison: ClearWeekComparison): Promise<ClearWeekGroupSample[]>
  readStageMoves(selection: ClearStageMoveSelection): Promise<ClearStageMoveCount[]>
  readStreaks(selection: ClearWeekSelection): Promise<ClearStreakCount[]>
  readFames(weekStart: Date): Promise<ClearFameSample[]>
  readJobFames(weekStart: Date): Promise<ClearJobFameSample[]>
  readCoClears(weekStart: Date): Promise<ClearCoClearCount[]>
  readRaidTimes(weekStart: Date): Promise<ClearTimeCount[]>
}
