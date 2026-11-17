import type { CharacterBasicInput } from './character.js'
import type { CharacterScoreInput } from './character-score.js'
import type { DatabaseClient } from './client.js'
import type { Prisma } from './generated/prisma/client.js'

export type CharacterHistoryKey = {
  serverId: string
  characterId: string
}

export type CharacterHistoryBasic = Omit<CharacterBasicInput, 'serverId' | 'characterId'>

export type CharacterHistoryScore = Pick<CharacterScoreInput, 'kind' | 'score' | 'engine'>

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

export type StoredCharacterHistorySnapshot = {
  basic: StoredCharacterBasicHistory
  score: StoredCharacterScoreHistory | null
  sections: Record<string, CharacterSectionBody>
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
  engine: { select: { package: true, rulesRev: true, bundleId: true } }
} as const

export async function recordCharacterHistory(
  client: DatabaseClient,
  input: CharacterHistoryInput
): Promise<void> {
  await client.$transaction(async (transaction) => {
    const { serverId, characterId } = input

    // 최신 행을 읽고 비교해 쓰는 사이에 같은 캐릭터의 다른 저장이 끼면 같은 값이 두 행이 되므로 읽기 전에 잡는다.
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(${historyLockNamespace}::int, hashtext(${`${serverId}/${characterId}`}))`
    const latest = await transaction.characterBasicHistory.findFirst({
      where: { serverId, characterId },
      orderBy: { observedAt: 'desc' }
    })

    if (latest !== null && input.observedAt <= latest.lastSeenAt) {
      return
    }

    await writeBasic(transaction, input, latest)
    await writeSections(transaction, input)

    if (input.score !== null) {
      await writeScore(transaction, input, input.score)
    }
  })
}

async function writeBasic(
  transaction: Prisma.TransactionClient,
  { serverId, characterId, observedAt, basic }: CharacterHistoryInput,
  latest: StoredCharacterBasicHistory | null
): Promise<void> {
  if (latest !== null && basicFields.every((field) => latest[field] === basic[field])) {
    await transaction.characterBasicHistory.update({
      where: {
        serverId_characterId_observedAt: { serverId, characterId, observedAt: latest.observedAt }
      },
      data: { lastSeenAt: observedAt }
    })

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
  { kind, score, engine }: CharacterHistoryScore
): Promise<void> {
  const engineId = await findOrCreateEngineId(transaction, engine)

  await transaction.$executeRaw`
    INSERT INTO "character_score_history"
      ("server_id", "character_id", "observed_at", "kind", "score", "engine_id")
    SELECT ${serverId}, ${characterId}, ${observedAt}, ${kind}, ${score}::integer, ${engineId}::integer
    WHERE NOT EXISTS (
      SELECT 1
      FROM (
        SELECT stored."kind", stored."score", stored."engine_id"
        FROM "character_score_history" stored
        WHERE stored."server_id" = ${serverId} AND stored."character_id" = ${characterId}
        ORDER BY stored."observed_at" DESC
        LIMIT 1
      ) AS latest
      WHERE latest."kind" = ${kind}
        AND latest."score" = ${score}::integer
        AND latest."engine_id" = ${engineId}::integer
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
  client: DatabaseClient,
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

  return { basics, scores, sectionChanges }
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
    client.$queryRaw<{ section: string; data: CharacterSectionBody }[]>`
      SELECT DISTINCT ON ("section") "section", "data"
      FROM "character_section_history"
      WHERE "server_id" = ${serverId} AND "character_id" = ${characterId} AND "observed_at" <= ${at}
      ORDER BY "section", "observed_at" DESC`
  ])

  if (basic === null) {
    return null
  }

  const sections = Object.fromEntries(sectionRows.map(({ section, data }) => [section, data]))

  return { basic, score, sections }
}
