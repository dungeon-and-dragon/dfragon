import type { CharacterScoreKind } from './character-score.js'
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

// 클리어를 처음 저장할 때만 그 시점 캐릭터의 최고 명성과 점수를 복사한다. 아래 ON CONFLICT 갱신은 이 칸을 바꾸지 않아,
// 그 뒤 명성이나 점수가 바뀌거나 같은 기록을 다시 저장해도 복사한 값은 그대로이고, 비어 있던 지난 행도 채우지 않는다.
const snapshotColumns = Prisma.sql`
  "max_fame", "score", "score_kind", "score_engine_package", "score_engine_rules_rev", "score_engine_bundle_id"`
const snapshotValues = Prisma.sql`
  copied_character.max_fame, copied_score.score, copied_score.kind, copied_score.engine_package,
  copied_score.engine_rules_rev, copied_score.engine_bundle_id`
const snapshotJoins = Prisma.sql`
  LEFT JOIN "characters" AS copied_character
    ON copied_character.server_id = clear.server_id AND copied_character.character_id = clear.character_id
  LEFT JOIN "character_scores" AS copied_score
    ON copied_score.server_id = clear.server_id AND copied_score.character_id = clear.character_id`

// 한 INSERT 안에서 같은 행을 두 번 고치면 PostgreSQL이 거절하므로 DISTINCT ON으로 가장 이른 클리어만 남긴다.
// 이미 있는 행도 더 이른 클리어가 들어올 때만 바꿔, 같은 기록을 어떤 순서로 다시 저장해도 결과가 같다.
async function recordRaidClears(
  client: DatabaseClient,
  clears: readonly ContentClearInput[]
): Promise<void> {
  const { contentIds, serverIds, characterIds, weekStarts, clearedAts, ratios } = toColumns(clears)

  await client.$executeRaw`
    INSERT INTO "content_clears"
      ("content_id", "kind", "server_id", "character_id", "week_start", "cleared_at", "ratio", ${snapshotColumns})
    SELECT
      clear.content_id, 'raid', clear.server_id, clear.character_id, clear.week_start, clear.cleared_at,
      clear.ratio, ${snapshotValues}
    FROM (
      SELECT DISTINCT ON (content_id, server_id, character_id, week_start) *
      FROM unnest(
        ${contentIds}::text[], ${serverIds}::text[], ${characterIds}::text[],
        ${weekStarts}::timestamptz[], ${clearedAts}::timestamptz[], ${ratios}::int[]
      ) AS clear(content_id, server_id, character_id, week_start, cleared_at, ratio)
      ORDER BY content_id, server_id, character_id, week_start, cleared_at
    ) AS clear
    ${snapshotJoins}
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
      ("content_id", "kind", "server_id", "character_id", "week_start", "cleared_at", "ratio", ${snapshotColumns})
    SELECT
      clear.content_id, 'challenge', clear.server_id, clear.character_id, clear.week_start, clear.cleared_at,
      clear.ratio, ${snapshotValues}
    FROM (
      SELECT DISTINCT ON (content_id, server_id, character_id) *
      FROM unnest(
        ${contentIds}::text[], ${serverIds}::text[], ${characterIds}::text[],
        ${weekStarts}::timestamptz[], ${clearedAts}::timestamptz[], ${ratios}::int[]
      ) AS clear(content_id, server_id, character_id, week_start, cleared_at, ratio)
      ORDER BY content_id, server_id, character_id, cleared_at
    ) AS clear
    ${snapshotJoins}
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

// 클리어할 때 복사한 명성을 먼저 쓰고, 복사 칸이 생기기 전에 저장한 행은 캐릭터의 지금 최고 명성을 쓴다.
const clearFameSql = Prisma.sql`coalesce(clear.max_fame, c.max_fame)`

// quantiles는 5%, 25%, 50%, 75%, 95% 순이다. percentile_disc는 저장된 명성 가운데 하나를 고르고,
// 명성이 없는 캐릭터는 분위수와 characters에서 빠진다.
const fameSampleColumnsSql = Prisma.sql`
  count(${clearFameSql})::int AS characters,
  percentile_disc(ARRAY[0.05, 0.25, 0.5, 0.75, 0.95]) WITHIN GROUP (ORDER BY ${clearFameSql}) AS quantiles,
  max(${clearFameSql}) AS max`

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
// 클리어 수도 같은 기준으로 세야 구간의 클리어율이 분모를 넘지 않는다.
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

const snapshotColumnsSql = Prisma.sql`
  server_id, character_id, max_fame, score_kind, score,
  score_engine_package, score_engine_rules_rev, score_engine_bundle_id`

// 이탈은 지난주에만, 복귀는 이번 주에만 깼고 지난주 전에 깬 적이 있는 캐릭터, 첫 클리어는 이번 주가 처음인 캐릭터다.
// 이탈은 지난주 행의 명성과 점수를, 나머지는 이번 주 행의 명성과 점수를 쓴다.
function weekGroupsSql({
  contentId,
  weekStart,
  previousWeekStart
}: ClearWeekComparison): Prisma.Sql {
  const pickSql = (column: string) =>
    Prisma.sql`CASE WHEN current_week.server_id IS NULL
      THEN previous_week.${Prisma.raw(column)} ELSE current_week.${Prisma.raw(column)} END
      AS ${Prisma.raw(column)}`

  return Prisma.sql`
    current_week AS (
      SELECT ${snapshotColumnsSql}
      FROM content_clears
      WHERE content_id = ${contentId} AND week_start = ${weekStart}
    ),
    previous_week AS (
      SELECT ${snapshotColumnsSql}
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
        END AS "group",
        ${pickSql('max_fame')},
        ${pickSql('score_kind')},
        ${pickSql('score')},
        ${pickSql('score_engine_package')},
        ${pickSql('score_engine_rules_rev')},
        ${pickSql('score_engine_bundle_id')}
      FROM current_week
      FULL JOIN previous_week USING (server_id, character_id)
    )`
}

export function readContentClearWeekGroups(
  client: DatabaseClient,
  comparison: ClearWeekComparison
): Promise<ClearWeekGroupSample[]> {
  return client.$queryRaw<ClearWeekGroupSample[]>`
    WITH ${weekGroupsSql(comparison)}
    SELECT clear."group", count(*)::int AS cleared, ${fameSampleColumnsSql}
    FROM grouped clear
    LEFT JOIN characters c
      ON c.server_id = clear.server_id AND c.character_id = clear.character_id
    GROUP BY clear."group"`
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

export type ClearScoreSample = ClearFameQuantiles & { kind: CharacterScoreKind }

export type ClearContentScoreSample = ClearScoreSample & { contentId: string }

export type ClearJobScoreSample = ClearContentScoreSample & {
  jobId: string | null
  jobGrowId: string | null
}

export type ClearWeekGroupScoreSample = ClearScoreSample & { group: ClearWeekGroup }

export type ClearScoreBandCount = {
  kind: CharacterScoreKind
  score: number
  population: number
  cleared: number
}

// 점수는 클리어할 때 복사한 값만 쓴다. 엔진 버전마다 같은 장비의 점수가 달라지므로, 고른 행 가운데
// 가장 많은 버전(package, rules, bundle이 모두 같은 것)의 행만 남긴다. 같은 수면 버전 이름 순으로 앞의 것이다.
function versionedScoresSql(columns: Prisma.Sql, from: Prisma.Sql, where: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`
    scored AS (
      SELECT
        ${columns},
        clear.score_kind AS kind,
        clear.score,
        clear.score_engine_package AS engine_package,
        clear.score_engine_rules_rev AS engine_rules_rev,
        clear.score_engine_bundle_id AS engine_bundle_id
      FROM ${from}
      WHERE ${where} AND clear.score IS NOT NULL
    ),
    engine AS (
      SELECT engine_package, engine_rules_rev, engine_bundle_id
      FROM scored
      GROUP BY engine_package, engine_rules_rev, engine_bundle_id
      ORDER BY count(*) DESC, engine_package, engine_rules_rev, engine_bundle_id
      LIMIT 1
    ),
    versioned AS (
      SELECT scored.*
      FROM scored
      JOIN engine USING (engine_package, engine_rules_rev, engine_bundle_id)
    )`
}

const scoreSampleColumnsSql = Prisma.sql`
  count(*)::int AS characters,
  percentile_disc(ARRAY[0.05, 0.25, 0.5, 0.75, 0.95]) WITHIN GROUP (ORDER BY versioned.score) AS quantiles,
  max(versioned.score) AS max`

export function readContentClearScores(
  client: DatabaseClient,
  weekStart: Date
): Promise<ClearContentScoreSample[]> {
  return client.$queryRaw<ClearContentScoreSample[]>`
    WITH ${versionedScoresSql(
      Prisma.sql`clear.content_id`,
      Prisma.sql`content_clears clear`,
      weekClearsSql(weekStart)
    )}
    SELECT versioned.content_id AS "contentId", versioned.kind, ${scoreSampleColumnsSql}
    FROM versioned
    GROUP BY versioned.content_id, versioned.kind`
}

function readJobScores(client: DatabaseClient, where: Prisma.Sql): Promise<ClearJobScoreSample[]> {
  return client.$queryRaw<ClearJobScoreSample[]>`
    WITH ${versionedScoresSql(
      Prisma.sql`clear.content_id, c.job_id, c.job_grow_id`,
      Prisma.sql`content_clears clear
        LEFT JOIN characters c
          ON c.server_id = clear.server_id AND c.character_id = clear.character_id`,
      where
    )}
    SELECT
      versioned.content_id AS "contentId",
      versioned.job_id AS "jobId",
      versioned.job_grow_id AS "jobGrowId",
      versioned.kind,
      ${scoreSampleColumnsSql}
    FROM versioned
    GROUP BY versioned.content_id, versioned.job_id, versioned.job_grow_id, versioned.kind`
}

export function readContentClearJobScores(
  client: DatabaseClient,
  weekStart: Date
): Promise<ClearJobScoreSample[]> {
  return readJobScores(client, weekClearsSql(weekStart))
}

export function readSelectedContentClearJobScores(
  client: DatabaseClient,
  selection: ClearWeekSelection
): Promise<ClearJobScoreSample[]> {
  return readJobScores(client, selectedClearsSql(selection))
}

export function readContentClearWeekGroupScores(
  client: DatabaseClient,
  comparison: ClearWeekComparison
): Promise<ClearWeekGroupScoreSample[]> {
  return client.$queryRaw<ClearWeekGroupScoreSample[]>`
    WITH ${weekGroupsSql(comparison)},
    ${versionedScoresSql(Prisma.sql`clear."group"`, Prisma.sql`grouped clear`, Prisma.sql`TRUE`)}
    SELECT versioned."group", versioned.kind, ${scoreSampleColumnsSql}
    FROM versioned
    GROUP BY versioned."group", versioned.kind`
}

// 구간 폭은 장비 점수 약 40만~140만, 버프 점수 약 10만~24만에서 구간이 20개 안팎이 되게 정했다.
const SCORE_BAND_WIDTHS: Readonly<Record<CharacterScoreKind, number>> = {
  equipment: 50_000,
  buff: 10_000
}

// 구간별 캐릭터 수는 분모 기준 명성 이상인 캐릭터의 지금 점수 가운데 클리어 점수와 같은 엔진 버전만 센다.
export function readContentClearScoreBands(
  client: DatabaseClient,
  selection: ClearWeekSelection,
  minFame: number
): Promise<ClearScoreBandCount[]> {
  return client.$queryRaw<ClearScoreBandCount[]>`
    WITH ${versionedScoresSql(
      Prisma.sql`clear.server_id`,
      Prisma.sql`content_clears clear`,
      selectedClearsSql(selection)
    )},
    width AS (
      SELECT *
      FROM unnest(
        ${Object.keys(SCORE_BAND_WIDTHS)}::text[],
        ${Object.values(SCORE_BAND_WIDTHS)}::int[]
      ) AS width(kind, size)
    ),
    population AS (
      SELECT stored.kind, (stored.score / width.size) * width.size AS score, count(*)::int AS population
      FROM character_scores stored
      JOIN characters c ON c.server_id = stored.server_id AND c.character_id = stored.character_id
      JOIN engine
        ON engine.engine_package = stored.engine_package
        AND engine.engine_rules_rev = stored.engine_rules_rev
        AND engine.engine_bundle_id = stored.engine_bundle_id
      JOIN width ON width.kind = stored.kind
      WHERE c.max_fame >= ${minFame}
      GROUP BY 1, 2
    ),
    cleared AS (
      SELECT versioned.kind, (versioned.score / width.size) * width.size AS score, count(*)::int AS cleared
      FROM versioned
      JOIN width ON width.kind = versioned.kind
      GROUP BY 1, 2
    )
    SELECT
      kind,
      score,
      coalesce(population.population, 0) AS population,
      coalesce(cleared.cleared, 0) AS cleared
    FROM population
    FULL JOIN cleared USING (kind, score)
    ORDER BY kind, score`
}
