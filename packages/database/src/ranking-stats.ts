import {
  type StoredCharacter,
  readStoredCharacterRows,
  readStoredCharacters,
  storedDealerSkillLearnedSql
} from './adventure-guild.js'
import type { CharacterEquipmentSet, CharacterOathSet } from './character-sets.js'
import type { CharacterScoreKind } from './character-score.js'
import type { DatabaseClient } from './client.js'
import { Prisma } from './generated/prisma/client.js'
import { type MaleCrusaderRole, maleCrusaderRoleSql } from './male-crusader.js'
import type { SkillStyleSelection } from './skill-style.js'

export type RankingSort = 'fame' | 'equipmentScore' | 'buffScore'

export type FameRankingFilter = {
  sort?: RankingSort
  jobId?: string
  jobGrowId?: string
  role?: MaleCrusaderRole
  equipmentSetId?: string
  oathSetId?: number
  oathSetOption?: string
  itemIds?: readonly string[]
  evolutions?: readonly SkillStyleSelection[]
  fameFrom?: number
  fameTo?: number
  scoreFrom?: number
  scoreTo?: number
}

export type FameRankingPosition = {
  value: number
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

export async function readAdventureSetCharacters(
  client: DatabaseClient,
  adventureName: string
): Promise<RankedStoredCharacter[]> {
  const rows = await readStoredCharacters<RankedRow>(
    client,
    Prisma.sql`a.name = ${adventureName}`,
    setColumns
  )

  return rows.map(toRankedCharacter)
}

// 명성은 내림차순, 서버와 캐릭터 ID는 오름차순이라 row 비교 하나로 쓸 수 없다.
// 앞의 fame <= 조건이 index 범위가 되어 이전 page의 행을 다시 훑지 않는다(합성 100만 행에서 365ms가 0.4ms로 줄었다).
// 낀 캐릭터가 이 수보다 적은 아이템은 그 캐릭터를 먼저 모아 명성 순으로 정렬하고, 많으면 명성 index를 따라 읽으며 거른다.
// planner는 드문 아이템에도 명성 순서로 읽어, 합성 100만 명에서 50명이 낀 아이템이 4.7초, 아무도 끼지 않은 아이템이 3.1초였다.
// 먼저 모으는 형태는 30만 명이 낀 아이템에서 page마다 0.7초였다. 아이템 하나만 걸었을 때 1만 명에서 두 형태가 87ms, 238ms, 2만 명에서 162ms, 132ms라
// 만나는 지점은 그 사이이고, 그 구간의 아래쪽인 1만 명으로 잡았다.
const GATHER_WEARERS_BELOW = 10_000

async function readWearerCount(client: DatabaseClient, itemId: string): Promise<number> {
  const [row] = await client.$queryRaw<{ count: number }[]>`
    SELECT count(*)::int AS count
    FROM (SELECT 1 FROM character_items WHERE item_id = ${itemId} LIMIT ${GATHER_WEARERS_BELOW}) bounded`

  if (row === undefined) {
    return 0
  }

  return row.count
}

async function pickGatheredItem(
  client: DatabaseClient,
  itemIds: readonly string[]
): Promise<string | undefined> {
  const counts = await Promise.all(
    itemIds.map(async (itemId) => {
      const count = await readWearerCount(client, itemId)

      return { itemId, count }
    })
  )
  const [rarest] = counts.toSorted((left, right) => left.count - right.count)

  if (rarest === undefined || rarest.count >= GATHER_WEARERS_BELOW) {
    return undefined
  }

  return rarest.itemId
}

// OFFSET 0이 subquery를 바깥으로 풀지 못하게 막아, planner가 다시 명성 순서로 읽는 계획을 고르지 않는다.
function gatheredWearersSql(itemId: string): Prisma.Sql {
  return Prisma.sql`JOIN (
    SELECT server_id, character_id FROM character_items WHERE item_id = ${itemId} OFFSET 0
  ) gathered ON gathered.server_id = c.server_id AND gathered.character_id = c.character_id`
}

function wearsItemSql(itemId: string): Prisma.Sql {
  return Prisma.sql`EXISTS (
    SELECT 1 FROM character_items item
    WHERE item.server_id = c.server_id AND item.character_id = c.character_id AND item.item_id = ${itemId}
  )`
}

// 스킬 스타일은 전직을 바꾸기 전 것이 남을 수 있어 지금 전직의 행만 본다.
function selectsEvolutionsSql(evolutions: readonly SkillStyleSelection[]): Prisma.Sql {
  const selected = JSON.stringify(evolutions.map(({ name, type }) => ({ name, type })))

  return Prisma.sql`EXISTS (
    SELECT 1 FROM character_skill_styles style
    WHERE style.server_id = c.server_id
      AND style.character_id = c.character_id
      AND style.job_id = c.job_id
      AND style.job_grow_id = c.job_grow_id
      AND style.evolutions @> ${selected}::jsonb
  )`
}

function afterPositionSql(
  sortValue: Prisma.Sql,
  { value, serverId, characterId }: FameRankingPosition
): Prisma.Sql {
  return Prisma.sql`${sortValue} <= ${value}
    AND (${sortValue} < ${value} OR (c.server_id, c.character_id) > (${serverId}, ${characterId}))`
}

const SCORE_KINDS: Record<Exclude<RankingSort, 'fame'>, CharacterScoreKind> = {
  equipmentScore: 'equipment',
  buffScore: 'buff'
}

type SortSource = {
  value: Prisma.Sql
  join: Prisma.Sql
  conditions: Prisma.Sql[]
}

function sortSource({
  sort = 'fame',
  jobId,
  jobGrowId,
  fameFrom,
  fameTo,
  scoreFrom,
  scoreTo
}: FameRankingFilter): SortSource {
  if (sort === 'fame') {
    const value = Prisma.sql`c.fame`
    const conditions = [
      Prisma.sql`c.fame IS NOT NULL`,
      ...(fameFrom !== undefined ? [Prisma.sql`c.fame >= ${fameFrom}::int`] : []),
      ...(fameTo !== undefined ? [Prisma.sql`c.fame <= ${fameTo}::int`] : [])
    ]

    return { value, join: Prisma.empty, conditions }
  }

  const value = Prisma.sql`ranked_score.score`
  const join = Prisma.sql`JOIN character_scores ranked_score
    ON ranked_score.server_id = c.server_id
    AND ranked_score.character_id = c.character_id
    AND ranked_score.kind = ${SCORE_KINDS[sort]}`

  // 점수 행의 전직은 점수를 계산할 때의 전직이다. 전직을 바꾼 뒤 다시 계산하지 않은 캐릭터는 characters 전직과 달라 직업 필터에 걸리지 않는다.
  const conditions = [
    ...(jobId !== undefined ? [Prisma.sql`ranked_score.job_id = ${jobId}`] : []),
    ...(jobGrowId !== undefined ? [Prisma.sql`ranked_score.job_grow_id = ${jobGrowId}`] : []),
    ...(scoreFrom !== undefined ? [Prisma.sql`ranked_score.score >= ${scoreFrom}::int`] : []),
    ...(scoreTo !== undefined ? [Prisma.sql`ranked_score.score <= ${scoreTo}::int`] : [])
  ]

  return { value, join, conditions }
}

export type ServerCount = {
  serverId: string
  count: number
}

export type FameBucket = {
  from: number
  to: number
  count: number
}

export type JobCount = {
  jobId: string
  jobGrowId: string
  jobName: string
  jobGrowName: string
  count: number
  averageFame: number | null
  fameBuckets: FameBucket[]
}

export type CharacterStats = {
  total: number
  servers: ServerCount[]
  jobs: JobCount[]
  fameDistribution: FameBucket[]
}

const FAME_BUCKET_SIZE = 1_000
const JOB_FAME_BUCKET_SIZE = 10_000

export async function readFameRanking(
  client: DatabaseClient,
  filter: FameRankingFilter,
  limit: number,
  after?: FameRankingPosition
): Promise<RankedStoredCharacter[]> {
  const {
    jobId,
    jobGrowId,
    role,
    equipmentSetId,
    oathSetId,
    oathSetOption,
    itemIds = [],
    evolutions = []
  } = filter
  const gatheredItem = await pickGatheredItem(client, itemIds)
  const sortBy = sortSource(filter)
  const conditions = [
    ...sortBy.conditions,
    ...(jobId !== undefined ? [Prisma.sql`c.job_id = ${jobId}`] : []),
    ...(jobGrowId !== undefined ? [Prisma.sql`c.job_grow_id = ${jobGrowId}`] : []),
    ...(role !== undefined ? [maleCrusaderRoleSql(storedDealerSkillLearnedSql, role)] : []),
    ...(equipmentSetId !== undefined ? [Prisma.sql`c.equipment_set_id = ${equipmentSetId}`] : []),
    ...(oathSetId !== undefined ? [Prisma.sql`c.oath_set_id = ${oathSetId}::int`] : []),
    ...(oathSetOption !== undefined ? [Prisma.sql`c.oath_set_option = ${oathSetOption}`] : []),
    ...itemIds.filter((itemId) => itemId !== gatheredItem).map(wearsItemSql),
    ...(evolutions.length > 0 ? [selectsEvolutionsSql(evolutions)] : []),
    ...(after !== undefined ? [afterPositionSql(sortBy.value, after)] : [])
  ]

  const gatheredJoin = gatheredItem !== undefined ? gatheredWearersSql(gatheredItem) : Prisma.empty
  const where =
    conditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty

  // 명성 기준일 때 ORDER BY의 fame DESC는 명성 index와 같은 NULLS FIRST여야 index 순서로 앞부분만 읽는다.
  const rows = await readStoredCharacterRows<RankedRow>(
    client,
    Prisma.sql`
      ${where}
      ORDER BY ${sortBy.value} DESC, c.server_id, c.character_id
      LIMIT ${limit}`,
    setColumns,
    Prisma.sql`${sortBy.join} ${gatheredJoin}`
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

  const bucketsByJob = await readJobFameBuckets(client)

  return rows.flatMap(({ jobId, jobGrowId, jobName, jobGrowName, _count, _avg }) => {
    if (jobId === null || jobGrowId === null || jobName === null || jobGrowName === null) {
      return []
    }

    const fameBuckets = bucketsByJob.get(jobKeyOf(jobId, jobGrowId)) ?? []

    return [
      {
        jobId,
        jobGrowId,
        jobName,
        jobGrowName,
        count: _count._all,
        averageFame: _avg.fame,
        fameBuckets
      }
    ]
  })
}

function jobKeyOf(jobId: string, jobGrowId: string): string {
  return `${jobId}/${jobGrowId}`
}

async function readJobFameBuckets(client: DatabaseClient): Promise<Map<string, FameBucket[]>> {
  const rows = await client.$queryRaw<
    { jobId: string; jobGrowId: string; from: number; count: number }[]
  >`
    SELECT job_id AS "jobId", job_grow_id AS "jobGrowId",
      (fame / ${JOB_FAME_BUCKET_SIZE}::int * ${JOB_FAME_BUCKET_SIZE}::int) AS "from",
      count(*)::int AS count
    FROM characters
    WHERE job_id IS NOT NULL AND job_grow_id IS NOT NULL AND fame IS NOT NULL
    GROUP BY 1, 2, 3
    ORDER BY 1, 2, 3`

  const buckets = new Map<string, FameBucket[]>()

  for (const { jobId, jobGrowId, from, count } of rows) {
    const key = jobKeyOf(jobId, jobGrowId)
    const bucket = { from, to: from + JOB_FAME_BUCKET_SIZE, count }
    buckets.set(key, [...(buckets.get(key) ?? []), bucket])
  }

  return buckets
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
  const [snapshot] = await client.$queryRaw<StoredCharacterStatsSnapshot[]>`
    SELECT computed_at AS "computedAt", total, servers, jobs, fame_distribution AS "fameDistribution"
    FROM character_stats`
  if (snapshot === undefined) {
    return null
  }

  // 직업별 명성 구간을 저장하기 전에 만든 스냅샷은 다음 계산 전까지 구간 없이 남아 있다.
  const jobs = snapshot.jobs.map(({ fameBuckets = [], ...job }) => ({ ...job, fameBuckets }))

  return { ...snapshot, jobs }
}

type StoredCharacterStatsSnapshot = Omit<CharacterStatsSnapshot, 'jobs'> & {
  jobs: (Omit<JobCount, 'fameBuckets'> & { fameBuckets?: FameBucket[] })[]
}
