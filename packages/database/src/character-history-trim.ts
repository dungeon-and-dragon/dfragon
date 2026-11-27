import {
  type CharacterHistoryKey,
  isFameLowered,
  isScoreLowered,
  lockCharacterHistory,
  readCharacterHistory,
  type StoredCharacterHistory,
  type StoredCharacterScoreHistory
} from './character-history.js'
import type { DatabaseClient } from './client.js'
import { Prisma } from './generated/prisma/client.js'

type LoweredHistoryInterval = {
  from: Date
  until: Date | null
}

type ObservedSpec = { fame: number | null; score: StoredCharacterScoreHistory | null }

const historyTables = [
  { table: Prisma.raw('"character_basic_history"'), sameSeries: Prisma.empty },
  { table: Prisma.raw('"character_score_history"'), sameSeries: Prisma.empty },
  {
    table: Prisma.raw('"character_section_history"'),
    sameSeries: Prisma.sql`AND later."section" = lowered."section"`
  }
]

export function findLoweredHistoryIntervals({
  basics,
  scores
}: Pick<StoredCharacterHistory, 'basics' | 'scores'>): LoweredHistoryInterval[] {
  const basicAt = new Map(basics.map((basic) => [basic.observedAt.getTime(), basic]))
  const scoreAt = new Map(scores.map((score) => [score.observedAt.getTime(), score]))
  const times = [...new Set([...basicAt.keys(), ...scoreAt.keys()])].sort(
    (left, right) => left - right
  )
  const intervals: LoweredHistoryInterval[] = []
  let observed: ObservedSpec = { fame: null, score: null }
  let recorded = observed
  let from: Date | null = null

  for (const time of times) {
    const basic = basicAt.get(time)
    const fame = basic !== undefined ? basic.fame : observed.fame
    const score = scoreAt.get(time) ?? observed.score
    observed = { fame, score }

    if (isFameLowered(fame, recorded.fame) || isScoreLowered(score, recorded.score)) {
      from ??= new Date(time)
      continue
    }

    if (from !== null) {
      intervals.push({ from, until: new Date(time) })
      from = null
    }

    recorded = observed
  }

  if (from !== null) {
    intervals.push({ from, until: null })
  }

  return intervals
}

export function readLoweredHistoryCharacters(
  client: DatabaseClient
): Promise<CharacterHistoryKey[]> {
  return client.$queryRaw<CharacterHistoryKey[]>`
    SELECT "server_id" AS "serverId", "character_id" AS "characterId"
    FROM (
      SELECT "server_id", "character_id", "fame" < LAG("fame") OVER history AS lowered
      FROM "character_basic_history"
      WINDOW history AS (PARTITION BY "server_id", "character_id" ORDER BY "observed_at")
    ) AS basic
    WHERE basic.lowered
    UNION
    SELECT "server_id", "character_id"
    FROM (
      SELECT "server_id", "character_id",
        "score" < LAG("score") OVER history
          AND "kind" = LAG("kind") OVER history
          AND "engine_id" = LAG("engine_id") OVER history
          AND "approximate_source" IS NOT DISTINCT FROM LAG("approximate_source") OVER history AS lowered
      FROM "character_score_history"
      WINDOW history AS (PARTITION BY "server_id", "character_id" ORDER BY "observed_at")
    ) AS score
    WHERE score.lowered
    ORDER BY "serverId", "characterId"`
}

/** 낮아진 구간의 행을 지우고 남은 이력을 지금 저장 규칙으로 쌓았을 때와 같게 맞춘다. 바꾼 것이 있으면 true다. */
export function trimLoweredCharacterHistory(
  client: DatabaseClient,
  key: CharacterHistoryKey
): Promise<boolean> {
  return client.$transaction(async (transaction) => {
    await lockCharacterHistory(transaction, key)
    const stored = await readCharacterHistory(transaction, key)
    const intervals = findLoweredHistoryIntervals(stored)

    if (intervals.length === 0) {
      return false
    }

    for (const interval of intervals) {
      await removeInterval(transaction, key, interval)
    }

    await removeRepeatedRows(transaction, key)
    const lastSeenTimes = stored.basics.map((basic) => basic.lastSeenAt.getTime())
    const lastSeenAt = new Date(Math.max(...lastSeenTimes))
    await transaction.$executeRaw`
      UPDATE "character_basic_history"
      SET "last_seen_at" = ${lastSeenAt}
      WHERE "server_id" = ${key.serverId} AND "character_id" = ${key.characterId}
        AND "observed_at" = (
          SELECT max("observed_at")
          FROM "character_basic_history"
          WHERE "server_id" = ${key.serverId} AND "character_id" = ${key.characterId}
        )`

    return true
  })
}

async function removeInterval(
  transaction: Prisma.TransactionClient,
  { serverId, characterId }: CharacterHistoryKey,
  { from, until }: LoweredHistoryInterval
): Promise<void> {
  for (const { table, sameSeries } of historyTables) {
    if (until === null) {
      await transaction.$executeRaw`
        DELETE FROM ${table}
        WHERE "server_id" = ${serverId} AND "character_id" = ${characterId} AND "observed_at" >= ${from}`
      continue
    }

    // 구간이 끝난 시각에 그대로 남아 있던 값은 그 시각의 값이므로, 구간의 마지막 행을 끝난 시각으로 옮긴다.
    await transaction.$executeRaw`
      UPDATE ${table} AS lowered
      SET "observed_at" = ${until}
      WHERE lowered."server_id" = ${serverId} AND lowered."character_id" = ${characterId}
        AND lowered."observed_at" >= ${from} AND lowered."observed_at" < ${until}
        AND NOT EXISTS (
          SELECT 1
          FROM ${table} AS later
          WHERE later."server_id" = ${serverId} AND later."character_id" = ${characterId}
            AND later."observed_at" > lowered."observed_at" AND later."observed_at" <= ${until}
            ${sameSeries}
        )`
    await transaction.$executeRaw`
      DELETE FROM ${table}
      WHERE "server_id" = ${serverId} AND "character_id" = ${characterId}
        AND "observed_at" >= ${from} AND "observed_at" < ${until}`
  }
}

async function removeRepeatedRows(
  transaction: Prisma.TransactionClient,
  { serverId, characterId }: CharacterHistoryKey
): Promise<void> {
  await transaction.$executeRaw`
    DELETE FROM "character_basic_history" AS repeated
    USING (
      SELECT "observed_at", basic = LAG(basic) OVER (ORDER BY "observed_at") AS same
      FROM (
        SELECT "observed_at", to_jsonb(history) - 'observed_at' - 'last_seen_at' AS basic
        FROM "character_basic_history" AS history
        WHERE "server_id" = ${serverId} AND "character_id" = ${characterId}
      ) AS basics
    ) AS compared
    WHERE repeated."server_id" = ${serverId} AND repeated."character_id" = ${characterId}
      AND repeated."observed_at" = compared."observed_at" AND compared.same`
  await transaction.$executeRaw`
    DELETE FROM "character_score_history" AS repeated
    USING (
      SELECT "observed_at",
        "kind" = LAG("kind") OVER history
          AND "score" = LAG("score") OVER history
          AND "engine_id" = LAG("engine_id") OVER history
          AND "approximate_source" IS NOT DISTINCT FROM LAG("approximate_source") OVER history AS same
      FROM "character_score_history"
      WHERE "server_id" = ${serverId} AND "character_id" = ${characterId}
      WINDOW history AS (ORDER BY "observed_at")
    ) AS compared
    WHERE repeated."server_id" = ${serverId} AND repeated."character_id" = ${characterId}
      AND repeated."observed_at" = compared."observed_at" AND compared.same`
  await transaction.$executeRaw`
    DELETE FROM "character_section_history" AS repeated
    USING (
      SELECT "section", "observed_at",
        "content_hash" = LAG("content_hash") OVER (PARTITION BY "section" ORDER BY "observed_at") AS same
      FROM "character_section_history"
      WHERE "server_id" = ${serverId} AND "character_id" = ${characterId}
    ) AS compared
    WHERE repeated."server_id" = ${serverId} AND repeated."character_id" = ${characterId}
      AND repeated."section" = compared."section"
      AND repeated."observed_at" = compared."observed_at" AND compared.same`
}
