import type { DatabaseClient } from './client.js'
import { Prisma } from './generated/prisma/client.js'

export const CLEAR_POPULATION_SIZE = 100_000

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
  fame: number
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

// 명성 랭킹과 같은 순서다. ORDER BY의 fame DESC는 명성 index와 같은 NULLS FIRST여야 index 순서로 앞부분만 읽는다.
export function readClearPopulation(client: DatabaseClient): Promise<ClearPopulationCharacter[]> {
  return client.$queryRaw<ClearPopulationCharacter[]>`
    SELECT
      server_id AS "serverId",
      character_id AS "characterId",
      fame,
      job_id AS "jobId",
      job_grow_id AS "jobGrowId",
      job_name AS "jobName",
      job_grow_name AS "jobGrowName"
    FROM characters
    WHERE fame IS NOT NULL
    ORDER BY fame DESC, server_id, character_id
    LIMIT ${CLEAR_POPULATION_SIZE}`
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

export type ClearJobCount = {
  jobId: string | null
  jobGrowId: string | null
  jobName: string | null
  jobGrowName: string | null
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

export function readContentClearJobCounts(
  client: DatabaseClient,
  selection: ClearWeekSelection
): Promise<ClearJobCount[]> {
  return client.$queryRaw<ClearJobCount[]>`
    SELECT
      c.job_id AS "jobId",
      c.job_grow_id AS "jobGrowId",
      c.job_name AS "jobName",
      c.job_grow_name AS "jobGrowName",
      count(*)::int AS cleared
    FROM content_clears clear
    LEFT JOIN characters c
      ON c.server_id = clear.server_id AND c.character_id = clear.character_id
    WHERE ${selectedClearsSql(selection)}
    GROUP BY c.job_id, c.job_grow_id, c.job_name, c.job_grow_name`
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
