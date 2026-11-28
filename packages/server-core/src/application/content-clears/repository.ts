import type {
  ClearAdventureSize,
  ClearContentScoreSample,
  ClearContentWeek,
  ClearContentWeekSamples,
  ClearFameBandCount,
  ClearFameSample,
  ClearFirstWeekCount,
  ClearJobFameSample,
  ClearJobScoreSample,
  ClearOverviewWeekSamples,
  ClearPopulationJob,
  ClearRecordRaidMode,
  ClearRecordRaidSelection,
  ClearRecordRaidStage,
  ClearRecordStageCount,
  ClearScoreBandCount,
  ClearWeekMoveCount,
  ClearWeekMoveSelection,
  ClearStreakCount,
  ClearTimeCount,
  ClearWeekComparison,
  ClearWeekGroupSample,
  ClearWeekGroupScoreSample,
  ClearWeekRatioCount,
  ClearWeekSelection,
  ContentClearPopulationInput,
  LegionClearWeek,
  StoredClearPopulation
} from '@dfragon/database'

export interface ClearSampleRepository {
  readAdventureSizes(selection: ClearWeekSelection): Promise<ClearAdventureSize[]>
  readContentJobFames(selection: ClearWeekSelection): Promise<ClearJobFameSample[]>
  readContentTimes(selection: ClearWeekSelection): Promise<ClearTimeCount[]>
  readFameBands(selection: ClearWeekSelection, minFame: number): Promise<ClearFameBandCount[]>
  readWeekGroups(comparison: ClearWeekComparison): Promise<ClearWeekGroupSample[]>
  readWeekMoves(selection: ClearWeekMoveSelection): Promise<ClearWeekMoveCount[]>
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
  readRaidTimes(weekStart: Date): Promise<ClearTimeCount[]>
}

export interface ClearStatsRepository extends ClearSampleRepository {
  readCollectedAt(): Promise<Date | null>
  readPopulations(): Promise<StoredClearPopulation[]>
  readWeekRatioCounts(): Promise<ClearWeekRatioCount[]>
  readFirstWeeks(contentId: string): Promise<ClearFirstWeekCount[]>
  readContentWeekSamples(week: ClearContentWeek): Promise<ClearContentWeekSamples | null>
  readOverviewSamples(weekStart: Date): Promise<ClearOverviewWeekSamples | null>
}

export interface ClearWeekSampleRepository extends ClearSampleRepository {
  readPopulations(): Promise<StoredClearPopulation[]>
  readContentWeekSampleWeeks(): Promise<ClearContentWeek[]>
  readOverviewSampleWeeks(): Promise<Date[]>
  readPopulationJobs(minMaxFame: number): Promise<ClearPopulationJob[]>
  recordLegionClears(week: LegionClearWeek): Promise<void>
  analyzeContentClears(): Promise<void>
  recordPopulation(population: ContentClearPopulationInput): Promise<void>
  recordContentWeekSamples(
    week: ClearContentWeek,
    samples: ClearContentWeekSamples,
    computedAt: Date
  ): Promise<void>
  recordOverviewSamples(
    weekStart: Date,
    samples: ClearOverviewWeekSamples,
    computedAt: Date
  ): Promise<void>
}
