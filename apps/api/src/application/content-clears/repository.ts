import type {
  ClearAdventureSize,
  ClearCoClearCount,
  ClearContentScoreSample,
  ClearContentWeek,
  ClearContentWeekSamples,
  ClearFameBandCount,
  ClearFameSample,
  ClearFirstWeekCount,
  ClearJobFameSample,
  ClearJobScoreSample,
  ClearOverviewWeekSamples,
  ClearPopulationCharacter,
  ClearRecordBackfillProgress,
  ClearRecordInput,
  ClearRecordLegionWeek,
  ClearRecordRaidMode,
  ClearRecordRaidSelection,
  ClearRecordRaidStage,
  ClearRecordStageCount,
  ClearScoreBandCount,
  ClearStageMoveCount,
  ClearStageMoveSelection,
  ClearStreakCount,
  ClearTimeCount,
  ClearWeekComparison,
  ClearWeekGroupSample,
  ClearWeekGroupScoreSample,
  ClearWeekRatioCount,
  ClearWeekSelection,
  ContentClearCollectionProgress,
  ContentClearInput,
  ContentClearPopulationInput,
  StoredClearPopulation
} from '@dfragon/database'

export interface ClearCollectionRepository {
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

export interface ClearRecordBackfillRepository {
  readPopulation(minMaxFame: number): Promise<ClearPopulationCharacter[]>
  readProgress(): Promise<ClearRecordBackfillProgress | undefined>
  startProgress(startedAt: Date): Promise<void>
  recordProgress(progress: ClearRecordBackfillProgress): Promise<void>
  recordRecords(records: readonly ClearRecordInput[]): Promise<void>
  finishProgress(startedAt: Date): Promise<void>
}

export interface ClearSampleRepository {
  readAdventureSizes(selection: ClearWeekSelection): Promise<ClearAdventureSize[]>
  readContentJobFames(selection: ClearWeekSelection): Promise<ClearJobFameSample[]>
  readContentTimes(selection: ClearWeekSelection): Promise<ClearTimeCount[]>
  readFameBands(selection: ClearWeekSelection, minFame: number): Promise<ClearFameBandCount[]>
  readWeekGroups(comparison: ClearWeekComparison): Promise<ClearWeekGroupSample[]>
  readStageMoves(selection: ClearStageMoveSelection): Promise<ClearStageMoveCount[]>
  readStreaks(selection: ClearWeekSelection): Promise<ClearStreakCount[]>
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

export interface ClearStatsRepository extends ClearSampleRepository {
  readCollectedAt(): Promise<Date | null>
  readPopulations(): Promise<StoredClearPopulation[]>
  readWeekRatioCounts(): Promise<ClearWeekRatioCount[]>
  readFirstWeeks(contentId: string): Promise<ClearFirstWeekCount[]>
  readLegionWeeks(names: readonly string[]): Promise<ClearRecordLegionWeek[]>
  readContentWeekSamples(week: ClearContentWeek): Promise<ClearContentWeekSamples | null>
  readOverviewSamples(weekStart: Date): Promise<ClearOverviewWeekSamples | null>
}
