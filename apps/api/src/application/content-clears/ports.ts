import type {
  ClearCoClearCount,
  ClearContentScoreSample,
  ClearJobScoreSample,
  ClearRecordLegionWeek,
  ClearRecordRaidMode,
  ClearRecordRaidSelection,
  ClearRecordRaidStage,
  ClearRecordStageCount,
  ClearScoreBandCount,
  ClearWeekGroupScoreSample,
  ClearFameBandCount,
  ClearFameSample,
  ClearFirstWeekCount,
  ClearJobFameSample,
  ClearStageMoveCount,
  ClearStageMoveSelection,
  ClearStreakCount,
  ClearTimeCount,
  StoredClearPopulation,
  ClearAdventureSize,
  ClearWeekComparison,
  ClearWeekGroupSample,
  ClearWeekRatioCount,
  ClearWeekSelection
} from '@dfragon/database'
import type { FetchCharacterTimeline } from '../character-timeline/ports.js'

export type CreateClearTimeline = (onRequest: () => void) => FetchCharacterTimeline

export type ClearCollectionPorts = {
  createFetchTimeline: CreateClearTimeline
  readConcurrency: () => number
  now: () => Date
  pause: (ms: number) => Promise<void>
  report: (code: string, details: Readonly<Record<string, string | number>>) => void
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
  readLegionWeeks(names: readonly string[]): Promise<ClearRecordLegionWeek[]>
  readRaidModes(selection: ClearRecordRaidSelection): Promise<ClearRecordRaidMode[]>
  readRaidStageCounts(
    selection: ClearRecordRaidSelection,
    stages: readonly ClearRecordRaidStage[]
  ): Promise<ClearRecordStageCount[]>
  readContentJobScores(selection: ClearWeekSelection): Promise<ClearJobScoreSample[]>
  readWeekGroupScores(comparison: ClearWeekComparison): Promise<ClearWeekGroupScoreSample[]>
  readScoreBands(selection: ClearWeekSelection, minFame: number): Promise<ClearScoreBandCount[]>
  readScores(weekStart: Date): Promise<ClearContentScoreSample[]>
  readJobScores(weekStart: Date): Promise<ClearJobScoreSample[]>
  readFames(weekStart: Date): Promise<ClearFameSample[]>
  readJobFames(weekStart: Date): Promise<ClearJobFameSample[]>
  readCoClears(weekStart: Date): Promise<ClearCoClearCount[]>
  readRaidTimes(weekStart: Date): Promise<ClearTimeCount[]>
}
