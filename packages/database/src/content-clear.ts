import type { DatabaseClient } from './client.js'

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
