import type { DatabaseClient } from './client.js'
import { Prisma } from './generated/prisma/client.js'

export type ContentClearKind = 'raid' | 'challenge'

export type ContentClearInput = {
  contentId: string
  kind: ContentClearKind
  serverId: string
  characterId: string
  clearedAt: Date
  weekStart: Date
  ratio: number | null
}

export type ClearPopulationJob = {
  jobId: string | null
  jobGrowId: string | null
  jobName: string | null
  jobGrowName: string | null
  count: number
}

export type ContentClearPopulationInput = {
  contentId: string
  weekStart: Date
  population: number
  minFame: number | null
  jobs: readonly ClearPopulationJob[]
  collectedAt: Date
  closed: boolean
}

export type ClearPopulationCharacter = {
  serverId: string
  characterId: string
  maxFame: number
  jobId: string | null
  jobGrowId: string | null
  jobName: string | null
  jobGrowName: string | null
}

function toColumns(clears: readonly ContentClearInput[]) {
  return {
    contentIds: clears.map(({ contentId }) => contentId),
    serverIds: clears.map(({ serverId }) => serverId),
    characterIds: clears.map(({ characterId }) => characterId),
    weekStarts: clears.map(({ weekStart }) => weekStart),
    clearedAts: clears.map(({ clearedAt }) => clearedAt),
    ratios: clears.map(({ ratio }) => ratio)
  }
}

// 한 INSERT 안에서 같은 행을 두 번 고치면 PostgreSQL이 거절하므로 DISTINCT ON으로 가장 이른 클리어만 남긴다.
// 이미 있는 행도 더 이른 클리어가 들어올 때만 바꿔, 같은 기록을 어떤 순서로 다시 저장해도 결과가 같다.
async function recordRaidClears(
  client: DatabaseClient,
  clears: readonly ContentClearInput[]
): Promise<void> {
  const { contentIds, serverIds, characterIds, weekStarts, clearedAts, ratios } = toColumns(clears)

  await client.$executeRaw`
    INSERT INTO "content_clears"
      ("content_id", "kind", "server_id", "character_id", "week_start", "cleared_at", "ratio")
    SELECT DISTINCT ON (content_id, server_id, character_id, week_start)
      content_id, 'raid', server_id, character_id, week_start, cleared_at, ratio
    FROM unnest(
      ${contentIds}::text[], ${serverIds}::text[], ${characterIds}::text[],
      ${weekStarts}::timestamptz[], ${clearedAts}::timestamptz[], ${ratios}::int[]
    ) AS clear(content_id, server_id, character_id, week_start, cleared_at, ratio)
    ORDER BY content_id, server_id, character_id, week_start, cleared_at
    ON CONFLICT ("content_id", "server_id", "character_id", "week_start") DO UPDATE SET
      "cleared_at" = EXCLUDED."cleared_at",
      "ratio" = EXCLUDED."ratio"
    WHERE "content_clears"."cleared_at" > EXCLUDED."cleared_at"`
}

async function recordChallengeClears(
  client: DatabaseClient,
  clears: readonly ContentClearInput[]
): Promise<void> {
  const { contentIds, serverIds, characterIds, weekStarts, clearedAts, ratios } = toColumns(clears)

  await client.$executeRaw`
    INSERT INTO "content_clears"
      ("content_id", "kind", "server_id", "character_id", "week_start", "cleared_at", "ratio")
    SELECT DISTINCT ON (content_id, server_id, character_id)
      content_id, 'challenge', server_id, character_id, week_start, cleared_at, ratio
    FROM unnest(
      ${contentIds}::text[], ${serverIds}::text[], ${characterIds}::text[],
      ${weekStarts}::timestamptz[], ${clearedAts}::timestamptz[], ${ratios}::int[]
    ) AS clear(content_id, server_id, character_id, week_start, cleared_at, ratio)
    ORDER BY content_id, server_id, character_id, cleared_at
    ON CONFLICT ("content_id", "server_id", "character_id") WHERE "kind" = 'challenge' DO UPDATE SET
      "week_start" = EXCLUDED."week_start",
      "cleared_at" = EXCLUDED."cleared_at",
      "ratio" = EXCLUDED."ratio"
    WHERE "content_clears"."cleared_at" > EXCLUDED."cleared_at"`
}

export async function recordContentClears(
  client: DatabaseClient,
  clears: readonly ContentClearInput[]
): Promise<void> {
  const raids = clears.filter(({ kind }) => kind === 'raid')
  const challenges = clears.filter(({ kind }) => kind === 'challenge')
  if (raids.length > 0) {
    await recordRaidClears(client, raids)
  }

  if (challenges.length > 0) {
    await recordChallengeClears(client, challenges)
  }
}

// 마감한 주의 분모는 나중에 다시 저장해도 바뀌지 않는다.
export async function recordContentClearPopulation(
  client: DatabaseClient,
  population: ContentClearPopulationInput
): Promise<void> {
  const { contentId, weekStart, population: size, minFame, jobs, collectedAt, closed } = population

  await client.$executeRaw`
    INSERT INTO "content_clear_populations"
      ("content_id", "week_start", "population", "min_fame", "jobs", "collected_at", "closed")
    VALUES (
      ${contentId}, ${weekStart}, ${size}, ${minFame}, ${JSON.stringify(jobs)}::jsonb,
      ${collectedAt}, ${closed}
    )
    ON CONFLICT ("content_id", "week_start") DO UPDATE SET
      "population" = EXCLUDED."population",
      "min_fame" = EXCLUDED."min_fame",
      "jobs" = EXCLUDED."jobs",
      "collected_at" = EXCLUDED."collected_at",
      "closed" = EXCLUDED."closed"
    WHERE NOT "content_clear_populations"."closed"`
}

export type ContentClearCollectionProgress = {
  startedAt: Date
  done: number
}

// 수집이 끝나기 전까지만 행이 있어, 다시 시작한 수집이 같은 시작 시각과 처리한 캐릭터 수로 이어 받는다.
export async function readContentClearCollection(
  client: DatabaseClient
): Promise<ContentClearCollectionProgress | undefined> {
  const progress = await client.contentClearCollection.findFirst({
    orderBy: { startedAt: 'asc' },
    select: { startedAt: true, done: true }
  })

  if (progress === null) {
    return undefined
  }

  return progress
}

export async function startContentClearCollection(
  client: DatabaseClient,
  startedAt: Date
): Promise<void> {
  await client.contentClearCollection.create({ data: { startedAt } })
}

export async function recordContentClearCollectionProgress(
  client: DatabaseClient,
  progress: ContentClearCollectionProgress
): Promise<void> {
  const { startedAt, done } = progress
  await client.contentClearCollection.update({ where: { startedAt }, data: { done } })
}

export async function finishContentClearCollection(
  client: DatabaseClient,
  startedAt: Date
): Promise<void> {
  await client.contentClearCollection.deleteMany({ where: { startedAt } })
}

// 최고 명성 index로 하한 이상만 읽는다. 같은 최고 명성은 서버, 캐릭터 순이라 다시 읽어도 순서가 같다.
export function readClearPopulation(
  client: DatabaseClient,
  minMaxFame: number
): Promise<ClearPopulationCharacter[]> {
  return client.$queryRaw<ClearPopulationCharacter[]>`
    SELECT
      server_id AS "serverId",
      character_id AS "characterId",
      max_fame AS "maxFame",
      job_id AS "jobId",
      job_grow_id AS "jobGrowId",
      job_name AS "jobName",
      job_grow_name AS "jobGrowName"
    FROM characters
    WHERE max_fame >= ${minMaxFame}
    ORDER BY max_fame DESC, server_id, character_id`
}

export type StoredClearPopulation = {
  contentId: string
  weekStart: Date
  population: number
  minFame: number | null
  jobs: ClearPopulationJob[]
  collectedAt: Date
  closed: boolean
}

export type ClearWeekRatioCount = {
  contentId: string
  weekStart: Date
  ratio: number | null
  cleared: number
}

export type ClearAdventureSize = {
  characters: number
  adventures: number
}

export type ClearWeekSelection = {
  contentId: string
  kind: ContentClearKind
  weekStart: Date
}

// 수집은 클리어 기록을 다 저장한 뒤 모집단을 저장하므로, 모집단의 마지막 수집 시각이 바뀌면 집계가 바뀐 것이다.
export async function readContentClearCollectedAt(client: DatabaseClient): Promise<Date | null> {
  const [row] = await client.$queryRaw<{ collectedAt: Date | null }[]>`
    SELECT max(collected_at) AS "collectedAt" FROM content_clear_populations`

  if (row === undefined) {
    return null
  }

  return row.collectedAt
}

export function readContentClearPopulations(
  client: DatabaseClient
): Promise<StoredClearPopulation[]> {
  return client.$queryRaw<StoredClearPopulation[]>`
    SELECT
      content_id AS "contentId",
      week_start AS "weekStart",
      population,
      min_fame AS "minFame",
      jobs,
      collected_at AS "collectedAt",
      closed
    FROM content_clear_populations
    ORDER BY content_id, week_start`
}

// 챌린지는 캐릭터당 처음 깬 주의 한 행이라 주별 수는 그 주에 새로 깬 수다.
export function readContentClearWeekRatioCounts(
  client: DatabaseClient
): Promise<ClearWeekRatioCount[]> {
  return client.$queryRaw<ClearWeekRatioCount[]>`
    SELECT
      content_id AS "contentId",
      week_start AS "weekStart",
      ratio,
      count(*)::int AS cleared
    FROM content_clears
    GROUP BY content_id, week_start, ratio
    ORDER BY content_id, week_start, ratio NULLS FIRST`
}

// 레이드는 그 주에 깬 캐릭터, 챌린지는 출시부터 그 주 끝까지 깬 캐릭터를 센다.
function selectedClearsSql({ contentId, kind, weekStart }: ClearWeekSelection): Prisma.Sql {
  const week =
    kind === 'challenge'
      ? Prisma.sql`clear.week_start <= ${weekStart}`
      : Prisma.sql`clear.week_start = ${weekStart}`

  return Prisma.sql`clear.content_id = ${contentId} AND ${week}`
}

// 캐릭터 행이 없는 클리어는 혼자인 모험단으로 세어 분포의 캐릭터 합이 클리어 수와 같게 한다.
export function readContentClearAdventureSizes(
  client: DatabaseClient,
  selection: ClearWeekSelection
): Promise<ClearAdventureSize[]> {
  return client.$queryRaw<ClearAdventureSize[]>`
    SELECT characters, count(*)::int AS adventures
    FROM (
      SELECT count(*)::int AS characters
      FROM content_clears clear
      LEFT JOIN characters c
        ON c.server_id = clear.server_id AND c.character_id = clear.character_id
      LEFT JOIN adventures a ON a.id = c.adventure_id
      WHERE ${selectedClearsSql(selection)}
      GROUP BY coalesce('adventure/' || a.name, 'character/' || clear.server_id || '/' || clear.character_id)
    ) adventure
    GROUP BY characters
    ORDER BY characters`
}

export type ClearFameQuantiles = {
  characters: number
  quantiles: number[] | null
  max: number | null
}

export type ClearFameSample = ClearFameQuantiles & { contentId: string }

export type ClearJobFameSample = ClearFameSample & {
  jobId: string | null
  jobGrowId: string | null
  jobName: string | null
  jobGrowName: string | null
  cleared: number
}

export type ClearCoClearCount = {
  contentId: string
  otherContentId: string
  cleared: number
}

export type ClearTimeCount = {
  weekday: number
  hour: number
  cleared: number
}

// 모든 컨텐츠를 한 주로 고른다. 레이드는 그 주에 깬 캐릭터, 챌린지는 출시부터 그 주 끝까지 깬 캐릭터다.
function weekClearsSql(weekStart: Date): Prisma.Sql {
  return Prisma.sql`(
    (clear.kind = 'raid' AND clear.week_start = ${weekStart})
    OR (clear.kind = 'challenge' AND clear.week_start <= ${weekStart})
  )`
}

// quantiles는 5%, 25%, 50%, 75%, 95% 순이다. percentile_disc는 저장된 명성 가운데 하나를 고르고,
// 명성이 없는 캐릭터는 분위수와 characters에서 빠진다.
const fameSampleColumnsSql = Prisma.sql`
  count(c.max_fame)::int AS characters,
  percentile_disc(ARRAY[0.05, 0.25, 0.5, 0.75, 0.95]) WITHIN GROUP (ORDER BY c.max_fame) AS quantiles,
  max(c.max_fame) AS max`

export function readContentClearFames(
  client: DatabaseClient,
  weekStart: Date
): Promise<ClearFameSample[]> {
  return client.$queryRaw<ClearFameSample[]>`
    SELECT clear.content_id AS "contentId", ${fameSampleColumnsSql}
    FROM content_clears clear
    LEFT JOIN characters c
      ON c.server_id = clear.server_id AND c.character_id = clear.character_id
    WHERE ${weekClearsSql(weekStart)}
    GROUP BY clear.content_id`
}

function readJobFames(client: DatabaseClient, where: Prisma.Sql): Promise<ClearJobFameSample[]> {
  return client.$queryRaw<ClearJobFameSample[]>`
    SELECT
      clear.content_id AS "contentId",
      c.job_id AS "jobId",
      c.job_grow_id AS "jobGrowId",
      c.job_name AS "jobName",
      c.job_grow_name AS "jobGrowName",
      count(*)::int AS cleared,
      ${fameSampleColumnsSql}
    FROM content_clears clear
    LEFT JOIN characters c
      ON c.server_id = clear.server_id AND c.character_id = clear.character_id
    WHERE ${where}
    GROUP BY clear.content_id, c.job_id, c.job_grow_id, c.job_name, c.job_grow_name`
}

export function readContentClearJobFames(
  client: DatabaseClient,
  weekStart: Date
): Promise<ClearJobFameSample[]> {
  return readJobFames(client, weekClearsSql(weekStart))
}

export function readSelectedContentClearJobFames(
  client: DatabaseClient,
  selection: ClearWeekSelection
): Promise<ClearJobFameSample[]> {
  return readJobFames(client, selectedClearsSql(selection))
}

// 한 주로 고르면 컨텐츠마다 캐릭터당 한 행이라 짝지은 행 수가 두 컨텐츠를 함께 깬 캐릭터 수다.
export function readContentClearCoClears(
  client: DatabaseClient,
  weekStart: Date
): Promise<ClearCoClearCount[]> {
  return client.$queryRaw<ClearCoClearCount[]>`
    WITH selected AS (
      SELECT clear.content_id, clear.server_id, clear.character_id
      FROM content_clears clear
      WHERE ${weekClearsSql(weekStart)}
    )
    SELECT
      base.content_id AS "contentId",
      other.content_id AS "otherContentId",
      count(*)::int AS cleared
    FROM selected base
    JOIN selected other
      ON other.server_id = base.server_id
      AND other.character_id = base.character_id
      AND other.content_id <> base.content_id
    GROUP BY base.content_id, other.content_id`
}

function readClearTimes(client: DatabaseClient, where: Prisma.Sql): Promise<ClearTimeCount[]> {
  return client.$queryRaw<ClearTimeCount[]>`
    SELECT
      extract(isodow FROM clear.cleared_at AT TIME ZONE 'Asia/Seoul')::int AS weekday,
      extract(hour FROM clear.cleared_at AT TIME ZONE 'Asia/Seoul')::int AS hour,
      count(*)::int AS cleared
    FROM content_clears clear
    WHERE ${where}
    GROUP BY 1, 2`
}

export function readContentClearRaidTimes(
  client: DatabaseClient,
  weekStart: Date
): Promise<ClearTimeCount[]> {
  return readClearTimes(client, Prisma.sql`clear.kind = 'raid' AND clear.week_start = ${weekStart}`)
}

export function readSelectedContentClearTimes(
  client: DatabaseClient,
  selection: ClearWeekSelection
): Promise<ClearTimeCount[]> {
  return readClearTimes(client, selectedClearsSql(selection))
}

export type ClearFirstWeekCount = {
  weekStart: Date
  characters: number
}

export type ClearFameBandCount = {
  fame: number
  population: number
  cleared: number
}

export type ClearWeekComparison = {
  contentId: string
  weekStart: Date
  previousWeekStart: Date
}

export type ClearWeekGroup = 'both' | 'left' | 'returned' | 'first'

export type ClearWeekGroupSample = ClearFameQuantiles & {
  group: ClearWeekGroup
  cleared: number
}

export type ClearStageMoveSelection = {
  hardContentId: string
  normalContentId: string
  weekStart: Date
  previousWeekStart: Date
}

export type ClearStagePrevious = 'same' | 'other' | 'none'

export type ClearStageMoveCount = {
  contentId: string
  previous: ClearStagePrevious
  characters: number
}

export type ClearStreakCount = {
  weeks: number
  characters: number
}

export function readContentClearFirstWeeks(
  client: DatabaseClient,
  contentId: string
): Promise<ClearFirstWeekCount[]> {
  return client.$queryRaw<ClearFirstWeekCount[]>`
    SELECT first_week AS "weekStart", count(*)::int AS characters
    FROM (
      SELECT min(week_start) AS first_week
      FROM content_clears
      WHERE content_id = ${contentId}
      GROUP BY server_id, character_id
    ) first_clear
    GROUP BY first_week
    ORDER BY first_week`
}

// 명성 구간의 캐릭터 수는 지난 주를 골라도 저장된 스냅샷이 없어 지금 최고 명성으로 센다.
export function readContentClearFameBands(
  client: DatabaseClient,
  selection: ClearWeekSelection,
  minFame: number
): Promise<ClearFameBandCount[]> {
  return client.$queryRaw<ClearFameBandCount[]>`
    WITH population AS (
      SELECT (max_fame / 2000) * 2000 AS fame, count(*)::int AS population
      FROM characters
      WHERE max_fame >= ${minFame}
      GROUP BY 1
    ),
    cleared AS (
      SELECT (c.max_fame / 2000) * 2000 AS fame, count(*)::int AS cleared
      FROM content_clears clear
      JOIN characters c
        ON c.server_id = clear.server_id AND c.character_id = clear.character_id
      WHERE ${selectedClearsSql(selection)} AND c.max_fame IS NOT NULL
      GROUP BY 1
    )
    SELECT
      fame,
      coalesce(population.population, 0) AS population,
      coalesce(cleared.cleared, 0) AS cleared
    FROM population
    FULL JOIN cleared USING (fame)
    ORDER BY fame`
}

// 이탈은 지난주에만, 복귀는 이번 주에만 깼고 지난주 전에 깬 적이 있는 캐릭터, 첫 클리어는 이번 주가 처음인 캐릭터다.
export function readContentClearWeekGroups(
  client: DatabaseClient,
  { contentId, weekStart, previousWeekStart }: ClearWeekComparison
): Promise<ClearWeekGroupSample[]> {
  return client.$queryRaw<ClearWeekGroupSample[]>`
    WITH current_week AS (
      SELECT server_id, character_id
      FROM content_clears
      WHERE content_id = ${contentId} AND week_start = ${weekStart}
    ),
    previous_week AS (
      SELECT server_id, character_id
      FROM content_clears
      WHERE content_id = ${contentId} AND week_start = ${previousWeekStart}
    ),
    grouped AS (
      SELECT
        server_id,
        character_id,
        CASE
          WHEN current_week.server_id IS NULL THEN 'left'
          WHEN previous_week.server_id IS NOT NULL THEN 'both'
          WHEN EXISTS (
            SELECT 1
            FROM content_clears earlier
            WHERE earlier.content_id = ${contentId}
              AND earlier.server_id = current_week.server_id
              AND earlier.character_id = current_week.character_id
              AND earlier.week_start < ${previousWeekStart}
          ) THEN 'returned'
          ELSE 'first'
        END AS "group"
      FROM current_week
      FULL JOIN previous_week USING (server_id, character_id)
    )
    SELECT grouped."group", count(*)::int AS cleared, ${fameSampleColumnsSql}
    FROM grouped
    LEFT JOIN characters c
      ON c.server_id = grouped.server_id AND c.character_id = grouped.character_id
    GROUP BY grouped."group"`
}

// 지난주에 두 단계를 모두 깼으면 같은 단계로 센다.
export function readContentClearStageMoves(
  client: DatabaseClient,
  { hardContentId, normalContentId, weekStart, previousWeekStart }: ClearStageMoveSelection
): Promise<ClearStageMoveCount[]> {
  return client.$queryRaw<ClearStageMoveCount[]>`
    SELECT
      clear.content_id AS "contentId",
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM content_clears previous
          WHERE previous.content_id = clear.content_id
            AND previous.server_id = clear.server_id
            AND previous.character_id = clear.character_id
            AND previous.week_start = ${previousWeekStart}
        ) THEN 'same'
        WHEN EXISTS (
          SELECT 1
          FROM content_clears previous
          WHERE previous.content_id = CASE clear.content_id
              WHEN ${hardContentId} THEN ${normalContentId}
              ELSE ${hardContentId}
            END
            AND previous.server_id = clear.server_id
            AND previous.character_id = clear.character_id
            AND previous.week_start = ${previousWeekStart}
        ) THEN 'other'
        ELSE 'none'
      END AS previous,
      count(*)::int AS characters
    FROM content_clears clear
    WHERE clear.content_id IN (${hardContentId}, ${normalContentId})
      AND clear.week_start = ${weekStart}
    GROUP BY 1, 2`
}

// 이번 주부터 거슬러 n번째 기록이 정확히 n-1주 전이면 그 n주는 끊기지 않고 이어진다.
export function readContentClearStreaks(
  client: DatabaseClient,
  { contentId, weekStart }: Pick<ClearWeekSelection, 'contentId' | 'weekStart'>
): Promise<ClearStreakCount[]> {
  return client.$queryRaw<ClearStreakCount[]>`
    WITH current_week AS (
      SELECT server_id, character_id
      FROM content_clears
      WHERE content_id = ${contentId} AND week_start = ${weekStart}
    ),
    history AS (
      SELECT
        clear.server_id,
        clear.character_id,
        clear.week_start,
        row_number() OVER (
          PARTITION BY clear.server_id, clear.character_id ORDER BY clear.week_start DESC
        ) AS position
      FROM content_clears clear
      JOIN current_week USING (server_id, character_id)
      WHERE clear.content_id = ${contentId} AND clear.week_start <= ${weekStart}
    ),
    streak AS (
      SELECT count(*) FILTER (
        WHERE week_start = ${weekStart}::timestamptz - (position - 1) * interval '7 days'
      )::int AS weeks
      FROM history
      GROUP BY server_id, character_id
    )
    SELECT weeks, count(*)::int AS characters
    FROM streak
    GROUP BY weeks
    ORDER BY weeks`
}
