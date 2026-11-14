import {
  type ClearAdventureSize,
  type ClearCoClearCount,
  type ClearContentScoreSample,
  type ClearContentWeek,
  type ClearContentWeekSamples,
  type ClearFameBandCount,
  type ClearFameSample,
  type ClearFirstWeekCount,
  type ClearJobFameSample,
  type ClearJobScoreSample,
  type ClearOverviewWeekSamples,
  type ClearRecordLegionWeek,
  type ClearRecordRaidMode,
  type ClearRecordRaidSelection,
  type ClearRecordRaidStage,
  type ClearRecordStageCount,
  type ClearScoreBandCount,
  type ClearStageMoveCount,
  type ClearStageMoveSelection,
  type ClearStreakCount,
  type ClearTimeCount,
  type ClearWeekComparison,
  type ClearWeekGroupSample,
  type ClearWeekGroupScoreSample,
  type ClearWeekRatioCount,
  type ClearWeekSelection,
  type DatabaseClient,
  type StoredClearPopulation,
  readClearRecordLegionWeeks,
  readClearRecordRaidModes,
  readClearRecordRaidStageCounts,
  readContentClearAdventureSizes,
  readContentClearCoClears,
  readContentClearCollectedAt,
  readContentClearFameBands,
  readContentClearFames,
  readContentClearFirstWeeks,
  readContentClearJobFames,
  readContentClearJobScores,
  readContentClearOverviewSampleWeeks,
  readContentClearOverviewSamples,
  readContentClearPopulations,
  readContentClearRaidTimes,
  readContentClearScoreBands,
  readContentClearScores,
  readContentClearStageMoves,
  readContentClearStreaks,
  readContentClearWeekGroupScores,
  readContentClearWeekGroups,
  readContentClearWeekRatioCounts,
  readContentClearWeekSampleWeeks,
  readContentClearWeekSamples,
  readSelectedContentClearJobFames,
  readSelectedContentClearJobScores,
  readSelectedContentClearTimes,
  recordContentClearOverviewSamples,
  recordContentClearWeekSamples
} from '@dfragon/database'
import type {
  ClearStatsRepository,
  ClearWeekSampleRepository
} from '../../application/content-clears/repository.js'

export class DatabaseClearStatsRepository
  implements ClearStatsRepository, ClearWeekSampleRepository
{
  constructor(private readonly client: DatabaseClient) {}

  readCollectedAt(): Promise<Date | null> {
    return readContentClearCollectedAt(this.client)
  }

  readPopulations(): Promise<StoredClearPopulation[]> {
    return readContentClearPopulations(this.client)
  }

  readWeekRatioCounts(): Promise<ClearWeekRatioCount[]> {
    return readContentClearWeekRatioCounts(this.client)
  }

  readAdventureSizes(selection: ClearWeekSelection): Promise<ClearAdventureSize[]> {
    return readContentClearAdventureSizes(this.client, selection)
  }

  readContentJobFames(selection: ClearWeekSelection): Promise<ClearJobFameSample[]> {
    return readSelectedContentClearJobFames(this.client, selection)
  }

  readContentTimes(selection: ClearWeekSelection): Promise<ClearTimeCount[]> {
    return readSelectedContentClearTimes(this.client, selection)
  }

  readFirstWeeks(contentId: string): Promise<ClearFirstWeekCount[]> {
    return readContentClearFirstWeeks(this.client, contentId)
  }

  readFameBands(selection: ClearWeekSelection, minFame: number): Promise<ClearFameBandCount[]> {
    return readContentClearFameBands(this.client, selection, minFame)
  }

  readWeekGroups(comparison: ClearWeekComparison): Promise<ClearWeekGroupSample[]> {
    return readContentClearWeekGroups(this.client, comparison)
  }

  readStageMoves(selection: ClearStageMoveSelection): Promise<ClearStageMoveCount[]> {
    return readContentClearStageMoves(this.client, selection)
  }

  readStreaks(selection: ClearWeekSelection): Promise<ClearStreakCount[]> {
    return readContentClearStreaks(this.client, selection)
  }

  readLegionWeeks(names: readonly string[]): Promise<ClearRecordLegionWeek[]> {
    return readClearRecordLegionWeeks(this.client, names)
  }

  readRaidModes(selection: ClearRecordRaidSelection): Promise<ClearRecordRaidMode[]> {
    return readClearRecordRaidModes(this.client, selection)
  }

  readRaidStageCounts(
    selection: ClearRecordRaidSelection,
    stages: readonly ClearRecordRaidStage[]
  ): Promise<ClearRecordStageCount[]> {
    return readClearRecordRaidStageCounts(this.client, selection, stages)
  }

  readContentJobScores(selection: ClearWeekSelection): Promise<ClearJobScoreSample[]> {
    return readSelectedContentClearJobScores(this.client, selection)
  }

  readWeekGroupScores(comparison: ClearWeekComparison): Promise<ClearWeekGroupScoreSample[]> {
    return readContentClearWeekGroupScores(this.client, comparison)
  }

  readScoreBands(selection: ClearWeekSelection, minFame: number): Promise<ClearScoreBandCount[]> {
    return readContentClearScoreBands(this.client, selection, minFame)
  }

  readScores(weekStart: Date): Promise<ClearContentScoreSample[]> {
    return readContentClearScores(this.client, weekStart)
  }

  readJobScores(weekStart: Date): Promise<ClearJobScoreSample[]> {
    return readContentClearJobScores(this.client, weekStart)
  }

  readFames(weekStart: Date): Promise<ClearFameSample[]> {
    return readContentClearFames(this.client, weekStart)
  }

  readJobFames(weekStart: Date): Promise<ClearJobFameSample[]> {
    return readContentClearJobFames(this.client, weekStart)
  }

  readCoClears(weekStart: Date): Promise<ClearCoClearCount[]> {
    return readContentClearCoClears(this.client, weekStart)
  }

  readRaidTimes(weekStart: Date): Promise<ClearTimeCount[]> {
    return readContentClearRaidTimes(this.client, weekStart)
  }

  readContentWeekSamples(week: ClearContentWeek): Promise<ClearContentWeekSamples | null> {
    return readContentClearWeekSamples(this.client, week)
  }

  readOverviewSamples(weekStart: Date): Promise<ClearOverviewWeekSamples | null> {
    return readContentClearOverviewSamples(this.client, weekStart)
  }

  readContentWeekSampleWeeks(): Promise<ClearContentWeek[]> {
    return readContentClearWeekSampleWeeks(this.client)
  }

  readOverviewSampleWeeks(): Promise<Date[]> {
    return readContentClearOverviewSampleWeeks(this.client)
  }

  recordContentWeekSamples(
    week: ClearContentWeek,
    samples: ClearContentWeekSamples,
    computedAt: Date
  ): Promise<void> {
    return recordContentClearWeekSamples(this.client, week, samples, computedAt)
  }

  recordOverviewSamples(
    weekStart: Date,
    samples: ClearOverviewWeekSamples,
    computedAt: Date
  ): Promise<void> {
    return recordContentClearOverviewSamples(this.client, weekStart, samples, computedAt)
  }
}
