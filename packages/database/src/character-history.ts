import type { CharacterBasicInput } from './character.js'
import type { CharacterScoreApproximation, CharacterScoreInput } from './character-score.js'
import type { DatabaseClient } from './client.js'
import type { Prisma } from './generated/prisma/client.js'

export type CharacterHistoryKey = {
  serverId: string
  characterId: string
}

export type CharacterHistoryBasic = Omit<CharacterBasicInput, 'serverId' | 'characterId'>

export type CharacterHistoryScore = Pick<
  CharacterScoreInput,
  'kind' | 'score' | 'engine' | 'approximate'
>

export type CharacterSectionBody = Readonly<Record<string, unknown>>

export type CharacterHistoryInput = CharacterHistoryKey & {
  observedAt: Date
  basic: CharacterHistoryBasic
  sections: Readonly<Record<string, CharacterSectionBody>>
  score: CharacterHistoryScore | null
}

export type StoredCharacterBasicHistory = CharacterHistoryBasic & {
  observedAt: Date
  lastSeenAt: Date
}

export type StoredCharacterScoreHistory = {
  observedAt: Date
  kind: string
  score: number
  engine: CharacterHistoryScore['engine']
  approximate: CharacterScoreApproximation | null
}

export type StoredCharacterSectionChange = {
  section: string
  observedAt: Date
}

export type StoredCharacterHistory = {
  basics: StoredCharacterBasicHistory[]
  scores: StoredCharacterScoreHistory[]
  sectionChanges: StoredCharacterSectionChange[]
}

export type StoredCharacterSection = {
  section: string
  observedAt: Date
  data: CharacterSectionBody
}

export type StoredCharacterHistorySnapshot = {
  // 고른 기본 정보, 점수, 섹션 행 가운데 가장 늦게 받은 시각이다. 그 시각에 받은 값이 이 스냅샷 전체와 같다.
  observedAt: Date
  basic: StoredCharacterBasicHistory
  score: StoredCharacterScoreHistory | null
  sections: Record<string, CharacterSectionBody>
}

type ComparableScore = Pick<StoredCharacterScoreHistory, 'kind' | 'score' | 'engine'> & {
  approximate: Pick<CharacterScoreApproximation, 'source'> | null
}

// timeline.ts의 캐릭터 lock(1175), character.ts의 모험단 lock(1176)과 다른 namespace다.
const historyLockNamespace = 1177

const basicColumns = {
  characterName: true,
  adventureName: true,
  level: true,
  jobId: true,
  jobGrowId: true,
  jobName: true,
  jobGrowName: true,
  fame: true,
  guildId: true,
  guildName: true
} as const satisfies Record<keyof CharacterHistoryBasic, true>

const basicFields = Object.keys(basicColumns) as (keyof CharacterHistoryBasic)[]

const scoreColumns = {
  observedAt: true,
  kind: true,
  score: true,
  engine: { select: { package: true, rulesRev: true, bundleId: true } },
  approximateSource: true,
  approximateWarning: true,
  skippedKind: true,
  skippedMessage: true
} as const

type ScoreHistoryRow = Prisma.CharacterScoreHistoryGetPayload<{ select: typeof scoreColumns }>

function toStoredScoreHistory(row: ScoreHistoryRow): StoredCharacterScoreHistory {
  const { approximateSource, approximateWarning, skippedKind, skippedMessage, ...score } = row

  if (
    approximateSource === null ||
    approximateWarning === null ||
    skippedKind === null ||
    skippedMessage === null
  ) {
    return { ...score, approximate: null }
  }

  const skipped = { kind: skippedKind, message: skippedMessage }

  return {
    ...score,
    approximate: { source: approximateSource, warning: approximateWarning, skipped }
  }
}

export function isFameLowered(fame: number | null, recorded: number | null): boolean {
  return fame !== null && recorded !== null && fame < recorded
}

export function isScoreLowered(
  score: ComparableScore | null,
  recorded: ComparableScore | null
): boolean {
  if (score === null || recorded === null) {
    return false
  }

  // 종류, 엔진 버전, 근사 방식이 다르면 같은 장비도 값이 달라 낮아졌는지 가릴 수 없다.
  const comparable =
    score.kind === recorded.kind &&
    score.engine.package === recorded.engine.package &&
    score.engine.rulesRev === recorded.engine.rulesRev &&
    score.engine.bundleId === recorded.engine.bundleId &&
    score.approximate?.source === recorded.approximate?.source

  return comparable && score.score < recorded.score
}

export function lockCharacterHistory(
  transaction: Prisma.TransactionClient,
  { serverId, characterId }: CharacterHistoryKey
): Promise<number> {
  return transaction.$executeRaw`SELECT pg_advisory_xact_lock(${historyLockNamespace}::int, hashtext(${`${serverId}/${characterId}`}))`
}

export async function recordCharacterHistory(
  client: DatabaseClient,
  input: CharacterHistoryInput
): Promise<void> {
  await client.$transaction(async (transaction) => {
    const { serverId, characterId } = input

    // 최신 행을 읽고 비교해 쓰는 사이에 같은 캐릭터의 다른 저장이 끼면 같은 값이 두 행이 되므로 읽기 전에 잡는다.
    await lockCharacterHistory(transaction, input)
    const latest = await transaction.characterBasicHistory.findFirst({
      where: { serverId, characterId },
      orderBy: { observedAt: 'desc' }
    })

    if (latest !== null && input.observedAt <= latest.lastSeenAt) {
      return
    }

    if (latest !== null && (await isLowered(transaction, input, latest.fame))) {
      // 점수 없이 같은 시각으로 다시 오는 저장이 낮아진 값을 쓰지 않게 확인 시각은 옮긴다.
      await extendLastSeen(transaction, input, latest.observedAt)

      return
    }

    await writeBasic(transaction, input, latest)
    await writeSections(transaction, input)

    if (input.score !== null) {
      await writeScore(transaction, input, input.score)
    }
  })
}

async function isLowered(
  transaction: Prisma.TransactionClient,
  { serverId, characterId, basic, score }: CharacterHistoryInput,
  recordedFame: number | null
): Promise<boolean> {
  if (isFameLowered(basic.fame, recordedFame)) {
    return true
  }

  if (score === null) {
    return false
  }

  const recorded = await transaction.characterScoreHistory.findFirst({
    where: { serverId, characterId },
    orderBy: { observedAt: 'desc' },
    select: scoreColumns
  })

  return recorded !== null && isScoreLowered(score, toStoredScoreHistory(recorded))
}

async function extendLastSeen(
  transaction: Prisma.TransactionClient,
  { serverId, characterId, observedAt }: CharacterHistoryInput,
  latestObservedAt: Date
): Promise<void> {
  await transaction.characterBasicHistory.update({
    where: {
      serverId_characterId_observedAt: { serverId, characterId, observedAt: latestObservedAt }
    },
    data: { lastSeenAt: observedAt }
  })
}

async function writeBasic(
  transaction: Prisma.TransactionClient,
  input: CharacterHistoryInput,
  latest: StoredCharacterBasicHistory | null
): Promise<void> {
  const { serverId, characterId, observedAt, basic } = input

  if (latest !== null && basicFields.every((field) => latest[field] === basic[field])) {
    await extendLastSeen(transaction, input, latest.observedAt)

    return
  }

  await transaction.characterBasicHistory.create({
    data: {
      serverId,
      characterId,
      observedAt,
      lastSeenAt: observedAt,
      characterName: basic.characterName,
      adventureName: basic.adventureName,
      level: basic.level,
      jobId: basic.jobId,
      jobGrowId: basic.jobGrowId,
      jobName: basic.jobName,
      jobGrowName: basic.jobGrowName,
      fame: basic.fame,
      guildId: basic.guildId,
      guildName: basic.guildName
    }
  })
}

async function writeSections(
  transaction: Prisma.TransactionClient,
  { serverId, characterId, observedAt, sections }: CharacterHistoryInput
): Promise<void> {
  const sectionsJson = JSON.stringify(sections)

  // jsonb는 key 순서와 공백을 정규화하므로 jsonb를 text로 바꾼 값의 hash는 key 순서가 달라도 같다.
  await transaction.$executeRaw`
    INSERT INTO "character_section_history"
      ("server_id", "character_id", "section", "observed_at", "content_hash", "data")
    SELECT ${serverId}, ${characterId}, received.section, ${observedAt}, received.content_hash, received.data
    FROM (
      SELECT input.key AS section, md5(input.value::text)::uuid AS content_hash, input.value AS data
      FROM jsonb_each(${sectionsJson}::jsonb) AS input
    ) AS received
    WHERE received.content_hash IS DISTINCT FROM (
      SELECT stored."content_hash"
      FROM "character_section_history" stored
      WHERE stored."server_id" = ${serverId}
        AND stored."character_id" = ${characterId}
        AND stored."section" = received.section
      ORDER BY stored."observed_at" DESC
      LIMIT 1
    )`
}

async function writeScore(
  transaction: Prisma.TransactionClient,
  { serverId, characterId, observedAt }: CharacterHistoryInput,
  { kind, score, engine, approximate }: CharacterHistoryScore
): Promise<void> {
  const engineId = await findOrCreateEngineId(transaction, engine)
  const approximateSource = approximate?.source ?? null
  const approximateWarning = approximate?.warning ?? null
  const skippedKind = approximate?.skipped.kind ?? null
  const skippedMessage = approximate?.skipped.message ?? null

  await transaction.$executeRaw`
    INSERT INTO "character_score_history"
      ("server_id", "character_id", "observed_at", "kind", "score", "engine_id",
       "approximate_source", "approximate_warning", "skipped_kind", "skipped_message")
    SELECT ${serverId}, ${characterId}, ${observedAt}, ${kind}, ${score}::integer, ${engineId}::integer,
      ${approximateSource}, ${approximateWarning}, ${skippedKind}, ${skippedMessage}
    WHERE NOT EXISTS (
      SELECT 1
      FROM (
        SELECT stored."kind", stored."score", stored."engine_id", stored."approximate_source"
        FROM "character_score_history" stored
        WHERE stored."server_id" = ${serverId} AND stored."character_id" = ${characterId}
        ORDER BY stored."observed_at" DESC
        LIMIT 1
      ) AS latest
      WHERE latest."kind" = ${kind}
        AND latest."score" = ${score}::integer
        AND latest."engine_id" = ${engineId}::integer
        AND latest."approximate_source" IS NOT DISTINCT FROM ${approximateSource}
    )`
}

async function findOrCreateEngineId(
  transaction: Prisma.TransactionClient,
  { package: enginePackage, rulesRev, bundleId }: CharacterHistoryScore['engine']
): Promise<number> {
  const where = { package_rulesRev_bundleId: { package: enginePackage, rulesRev, bundleId } }
  const stored = await transaction.scoreEngine.findUnique({ where, select: { id: true } })

  if (stored !== null) {
    return stored.id
  }

  // 다른 캐릭터의 저장이 같은 새 엔진을 먼저 넣었으면 unique 충돌을 넘기고 다음 문장에서 그 행을 읽는다.
  // DO UPDATE로 id를 돌려받으면 같은 엔진 행을 모든 저장이 잠가 저장이 한 줄로 선다.
  await transaction.$executeRaw`
    INSERT INTO "score_engines" ("package", "rules_rev", "bundle_id")
    VALUES (${enginePackage}, ${rulesRev}, ${bundleId})
    ON CONFLICT DO NOTHING`
  const created = await transaction.scoreEngine.findUniqueOrThrow({ where, select: { id: true } })

  return created.id
}

export async function readCharacterHistory(
  client: DatabaseClient | Prisma.TransactionClient,
  { serverId, characterId }: CharacterHistoryKey
): Promise<StoredCharacterHistory> {
  const where = { serverId, characterId }
  const [basics, scores, sectionChanges] = await Promise.all([
    client.characterBasicHistory.findMany({
      where,
      orderBy: { observedAt: 'asc' },
      select: { observedAt: true, lastSeenAt: true, ...basicColumns }
    }),
    client.characterScoreHistory.findMany({
      where,
      orderBy: { observedAt: 'asc' },
      select: scoreColumns
    }),
    client.characterSectionHistory.findMany({
      where,
      orderBy: [{ section: 'asc' }, { observedAt: 'asc' }],
      select: { section: true, observedAt: true }
    })
  ])

  const storedScores = scores.map(toStoredScoreHistory)

  return { basics, scores: storedScores, sectionChanges }
}

export function readCharacterSectionHistory(
  client: DatabaseClient,
  { serverId, characterId }: CharacterHistoryKey,
  sections: readonly string[]
): Promise<StoredCharacterSection[]> {
  return client.$queryRaw<StoredCharacterSection[]>`
    SELECT "section", "observed_at" AS "observedAt", "data"
    FROM "character_section_history"
    WHERE "server_id" = ${serverId} AND "character_id" = ${characterId}
      AND "section" = ANY(${[...sections]}::text[])
    ORDER BY "observed_at", "section"`
}

export async function readCharacterHistorySnapshot(
  client: DatabaseClient,
  { serverId, characterId }: CharacterHistoryKey,
  at: Date
): Promise<StoredCharacterHistorySnapshot | null> {
  const where = { serverId, characterId, observedAt: { lte: at } }
  const [basic, score, sectionRows] = await Promise.all([
    client.characterBasicHistory.findFirst({
      where,
      orderBy: { observedAt: 'desc' },
      select: { observedAt: true, lastSeenAt: true, ...basicColumns }
    }),
    client.characterScoreHistory.findFirst({
      where,
      orderBy: { observedAt: 'desc' },
      select: scoreColumns
    }),
    client.$queryRaw<{ section: string; observedAt: Date; data: CharacterSectionBody }[]>`
      SELECT DISTINCT ON ("section") "section", "observed_at" AS "observedAt", "data"
      FROM "character_section_history"
      WHERE "server_id" = ${serverId} AND "character_id" = ${characterId} AND "observed_at" <= ${at}
      ORDER BY "section", "observed_at" DESC`
  ])

  if (basic === null) {
    return null
  }

  const sections = Object.fromEntries(sectionRows.map(({ section, data }) => [section, data]))
  const observedTimes = [basic, score, ...sectionRows].flatMap((row) => row?.observedAt ?? [])
  const observedAt = new Date(Math.max(...observedTimes.map((time) => time.getTime())))
  const storedScore = score !== null ? toStoredScoreHistory(score) : null

  return { observedAt, basic, score: storedScore, sections }
}
