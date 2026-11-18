import {
  type StoredCharacter,
  readStoredCharacterRows,
  storedDealerSkillLearnedSql
} from './adventure-guild.js'
import type { CharacterEquipmentSet, CharacterOathSet } from './character-sets.js'
import type { DatabaseClient } from './client.js'
import { Prisma } from './generated/prisma/client.js'
import { type MaleCrusaderRole, maleCrusaderRoleSql } from './male-crusader.js'

export type FameRankingFilter = {
  jobId?: string
  jobGrowId?: string
  role?: MaleCrusaderRole
  equipmentSetId?: string
  oathSetId?: number
  oathSetOption?: string
}

export type FameRankingPosition = {
  fame: number
  serverId: string
  characterId: string
}

export type RankedStoredCharacter = StoredCharacter & {
  equipmentSet: CharacterEquipmentSet | null
  oathSet: CharacterOathSet | null
}

type RankedRow = StoredCharacter & {
  equipmentSetId: string | null
  equipmentSetName: string | null
  oathSetId: number | null
  oathSetName: string | null
  oathSetOption: string | null
}

const setColumns = Prisma.sql`,
  c.equipment_set_id AS "equipmentSetId",
  c.equipment_set_name AS "equipmentSetName",
  c.oath_set_id AS "oathSetId",
  c.oath_set_name AS "oathSetName",
  c.oath_set_option AS "oathSetOption"`

function toRankedCharacter({
  equipmentSetId,
  equipmentSetName,
  oathSetId,
  oathSetName,
  oathSetOption,
  ...character
}: RankedRow): RankedStoredCharacter {
  // 저장 함수가 세트 id와 이름을 함께 쓰므로 둘 중 하나만 있는 행은 없다.
  const equipmentSet =
    equipmentSetId !== null && equipmentSetName !== null
      ? { id: equipmentSetId, name: equipmentSetName }
      : null
  const oathSet =
    oathSetId !== null && oathSetName !== null
      ? { id: oathSetId, name: oathSetName, option: oathSetOption }
      : null

  return { ...character, equipmentSet, oathSet }
}

// 명성은 내림차순, 서버와 캐릭터 ID는 오름차순이라 row 비교 하나로 쓸 수 없다.
// 앞의 fame <= 조건이 index 범위가 되어 이전 page의 행을 다시 훑지 않는다(합성 100만 행에서 365ms가 0.4ms로 줄었다).
function afterPositionSql({ fame, serverId, characterId }: FameRankingPosition): Prisma.Sql {
  return Prisma.sql`c.fame <= ${fame}
    AND (c.fame < ${fame} OR (c.server_id, c.character_id) > (${serverId}, ${characterId}))`
}

export type ServerCount = {
  serverId: string
  count: number
}

export type JobCount = {
  jobId: string
  jobGrowId: string
  jobName: string
  jobGrowName: string
  count: number
  averageFame: number | null
}

export type FameBucket = {
  from: number
  to: number
  count: number
}

export type CharacterStats = {
  total: number
  servers: ServerCount[]
  jobs: JobCount[]
  fameDistribution: FameBucket[]
}

const FAME_BUCKET_SIZE = 1_000

export async function readFameRanking(
  client: DatabaseClient,
  filter: FameRankingFilter,
  limit: number,
  after?: FameRankingPosition
): Promise<RankedStoredCharacter[]> {
  const { jobId, jobGrowId, role, equipmentSetId, oathSetId, oathSetOption } = filter
  const conditions = [
    Prisma.sql`c.fame IS NOT NULL`,
    ...(jobId !== undefined ? [Prisma.sql`c.job_id = ${jobId}`] : []),
    ...(jobGrowId !== undefined ? [Prisma.sql`c.job_grow_id = ${jobGrowId}`] : []),
    ...(role !== undefined ? [maleCrusaderRoleSql(storedDealerSkillLearnedSql, role)] : []),
    ...(equipmentSetId !== undefined ? [Prisma.sql`c.equipment_set_id = ${equipmentSetId}`] : []),
    ...(oathSetId !== undefined ? [Prisma.sql`c.oath_set_id = ${oathSetId}::int`] : []),
    ...(oathSetOption !== undefined ? [Prisma.sql`c.oath_set_option = ${oathSetOption}`] : []),
    ...(after !== undefined ? [afterPositionSql(after)] : [])
  ]

  // ORDER BY의 fame DESC는 명성 index와 같은 NULLS FIRST여야 index 순서로 앞부분만 읽는다.
  const rows = await readStoredCharacterRows<RankedRow>(
    client,
    Prisma.sql`
      WHERE ${Prisma.join(conditions, ' AND ')}
      ORDER BY c.fame DESC, c.server_id, c.character_id
      LIMIT ${limit}`,
    setColumns
  )

  return rows.map(toRankedCharacter)
}

async function readServerCounts(client: DatabaseClient): Promise<ServerCount[]> {
  const rows = await client.character.groupBy({
    by: ['serverId'],
    _count: { _all: true },
    orderBy: [{ _count: { serverId: 'desc' } }, { serverId: 'asc' }]
  })

  return rows.map(({ serverId, _count }) => ({ serverId, count: _count._all }))
}

async function readJobCounts(client: DatabaseClient): Promise<JobCount[]> {
  const rows = await client.character.groupBy({
    by: ['jobId', 'jobGrowId', 'jobName', 'jobGrowName'],
    where: {
      jobId: { not: null },
      jobGrowId: { not: null },
      jobName: { not: null },
      jobGrowName: { not: null }
    },
    _count: { _all: true },
    _avg: { fame: true },
    orderBy: [{ _count: { jobId: 'desc' } }, { jobId: 'asc' }, { jobGrowId: 'asc' }]
  })

  return rows.flatMap(({ jobId, jobGrowId, jobName, jobGrowName, _count, _avg }) => {
    if (jobId === null || jobGrowId === null || jobName === null || jobGrowName === null) {
      return []
    }

    return [{ jobId, jobGrowId, jobName, jobGrowName, count: _count._all, averageFame: _avg.fame }]
  })
}

async function readFameDistribution(client: DatabaseClient): Promise<FameBucket[]> {
  const rows = await client.$queryRaw<{ from: number; count: number }[]>`
    SELECT (fame / ${FAME_BUCKET_SIZE}::int * ${FAME_BUCKET_SIZE}::int) AS "from", count(*)::int AS count
    FROM characters
    WHERE fame IS NOT NULL
    GROUP BY 1
    ORDER BY 1`

  return rows.map(({ from, count }) => {
    const to = from + FAME_BUCKET_SIZE

    return { from, to, count }
  })
}

export async function readCharacterStats(client: DatabaseClient): Promise<CharacterStats> {
  const [total, servers, jobs, fameDistribution] = await Promise.all([
    client.character.count(),
    readServerCounts(client),
    readJobCounts(client),
    readFameDistribution(client)
  ])

  return { total, servers, jobs, fameDistribution }
}

export type CharacterStatsSnapshot = CharacterStats & {
  computedAt: Date
}

export async function saveCharacterStats(
  client: DatabaseClient,
  { computedAt, total, servers, jobs, fameDistribution }: CharacterStatsSnapshot
): Promise<void> {
  const values = { computedAt, total, servers, jobs, fameDistribution }
  await client.characterStatsSnapshot.upsert({
    where: { id: 1 },
    create: values,
    update: values
  })
}

export async function readCharacterStatsSnapshot(
  client: DatabaseClient
): Promise<CharacterStatsSnapshot | null> {
  const [snapshot] = await client.$queryRaw<CharacterStatsSnapshot[]>`
    SELECT computed_at AS "computedAt", total, servers, jobs, fame_distribution AS "fameDistribution"
    FROM character_stats`
  if (snapshot === undefined) {
    return null
  }

  return snapshot
}
