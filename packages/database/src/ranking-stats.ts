import type { StoredCharacter } from './adventure-guild.js'
import type { DatabaseClient } from './client.js'
import type { Prisma } from './generated/prisma/client.js'

export type FameRankingFilter = {
  jobId?: string
  jobGrowId?: string
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

const FAME_BUCKET_SIZE = 10_000

export async function readFameRanking(
  client: DatabaseClient,
  { jobId, jobGrowId }: FameRankingFilter,
  limit: number
): Promise<StoredCharacter[]> {
  const rows = await client.character.findMany({
    where: { fame: { not: null }, jobId, jobGrowId },
    orderBy: [{ fame: 'desc' }, { serverId: 'asc' }, { characterId: 'asc' }],
    take: limit,
    select: {
      serverId: true,
      characterId: true,
      characterName: true,
      adventure: { select: { name: true } },
      level: true,
      jobId: true,
      jobGrowId: true,
      jobName: true,
      jobGrowName: true,
      fame: true,
      guildId: true,
      guildName: true,
      basicFetchedAt: true
    } satisfies Prisma.CharacterSelect
  })

  return rows.map(({ adventure, basicFetchedAt, ...row }) => ({
    ...row,
    adventureName: adventure.name,
    fetchedAt: basicFetchedAt
  }))
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
