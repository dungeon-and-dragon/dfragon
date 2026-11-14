import type { ClearRecordStageCount } from './clear-record.js'
import type { DatabaseClient } from './client.js'
import type {
  ClearAdventureSize,
  ClearCoClearCount,
  ClearContentScoreSample,
  ClearFameBandCount,
  ClearFameSample,
  ClearJobFameSample,
  ClearJobScoreSample,
  ClearScoreBandCount,
  ClearStageMoveCount,
  ClearStreakCount,
  ClearTimeCount,
  ClearWeekGroupSample,
  ClearWeekGroupScoreSample
} from './content-clear.js'

export type ClearContentWeekSamples = {
  jobFames: ClearJobFameSample[]
  jobScores: ClearJobScoreSample[]
  adventures: ClearAdventureSize[]
  fameBands: ClearFameBandCount[]
  scoreBands: ClearScoreBandCount[]
  times: ClearTimeCount[]
  weekGroups: ClearWeekGroupSample[] | null
  weekGroupScores: ClearWeekGroupScoreSample[] | null
  stageMoves: ClearStageMoveCount[] | null
  streaks: ClearStreakCount[] | null
  stages: ClearRecordStageCount[] | null
}

export type ClearOverviewWeekSamples = {
  fames: ClearFameSample[]
  jobFames: ClearJobFameSample[]
  scores: ClearContentScoreSample[]
  jobScores: ClearJobScoreSample[]
  coClears: ClearCoClearCount[]
  raidTimes: ClearTimeCount[]
}

export type ClearContentWeek = {
  contentId: string
  weekStart: Date
}

export async function recordContentClearWeekSamples(
  client: DatabaseClient,
  { contentId, weekStart }: ClearContentWeek,
  samples: ClearContentWeekSamples,
  computedAt: Date
): Promise<void> {
  await client.$executeRaw`
    INSERT INTO content_clear_week_samples (content_id, week_start, samples, computed_at)
    VALUES (${contentId}, ${weekStart}, ${JSON.stringify(samples)}::jsonb, ${computedAt})
    ON CONFLICT (content_id, week_start) DO UPDATE SET
      samples = EXCLUDED.samples,
      computed_at = EXCLUDED.computed_at`
}

export async function readContentClearWeekSamples(
  client: DatabaseClient,
  { contentId, weekStart }: ClearContentWeek
): Promise<ClearContentWeekSamples | null> {
  const [row] = await client.$queryRaw<{ samples: ClearContentWeekSamples }[]>`
    SELECT samples
    FROM content_clear_week_samples
    WHERE content_id = ${contentId} AND week_start = ${weekStart}`

  if (row === undefined) {
    return null
  }

  return row.samples
}

export function readContentClearWeekSampleWeeks(
  client: DatabaseClient
): Promise<ClearContentWeek[]> {
  return client.$queryRaw<ClearContentWeek[]>`
    SELECT content_id AS "contentId", week_start AS "weekStart"
    FROM content_clear_week_samples`
}

export async function recordContentClearOverviewSamples(
  client: DatabaseClient,
  weekStart: Date,
  samples: ClearOverviewWeekSamples,
  computedAt: Date
): Promise<void> {
  await client.$executeRaw`
    INSERT INTO content_clear_overview_samples (week_start, samples, computed_at)
    VALUES (${weekStart}, ${JSON.stringify(samples)}::jsonb, ${computedAt})
    ON CONFLICT (week_start) DO UPDATE SET
      samples = EXCLUDED.samples,
      computed_at = EXCLUDED.computed_at`
}

export async function readContentClearOverviewSamples(
  client: DatabaseClient,
  weekStart: Date
): Promise<ClearOverviewWeekSamples | null> {
  const [row] = await client.$queryRaw<{ samples: ClearOverviewWeekSamples }[]>`
    SELECT samples
    FROM content_clear_overview_samples
    WHERE week_start = ${weekStart}`

  if (row === undefined) {
    return null
  }

  return row.samples
}

export async function readContentClearOverviewSampleWeeks(client: DatabaseClient): Promise<Date[]> {
  const rows = await client.$queryRaw<{ weekStart: Date }[]>`
    SELECT week_start AS "weekStart"
    FROM content_clear_overview_samples`

  return rows.map(({ weekStart }) => weekStart)
}
