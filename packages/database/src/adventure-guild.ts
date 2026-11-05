import type { DatabaseClient } from './client.js'
import type { Prisma } from './generated/prisma/client.js'

export type StoredCharacter = {
  serverId: string
  characterId: string
  characterName: string
  adventureName: string
  level: number | null
  jobId: string | null
  jobGrowId: string | null
  jobName: string | null
  jobGrowName: string | null
  fame: number | null
  guildId: string | null
  guildName: string | null
  fetchedAt: Date | null
}

export type StoredGuild = {
  guildName: string | null
  members: StoredCharacter[]
}

const storedCharacterSelect = {
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

const fameOrder = [
  { fame: { sort: 'desc', nulls: 'last' } },
  { serverId: 'asc' },
  { characterId: 'asc' }
] satisfies Prisma.CharacterOrderByWithRelationInput[]

async function readStoredCharacters(
  client: DatabaseClient,
  where: Prisma.CharacterWhereInput
): Promise<StoredCharacter[]> {
  const rows = await client.character.findMany({
    where,
    orderBy: fameOrder,
    select: storedCharacterSelect
  })

  return rows.map(({ adventure, basicFetchedAt, ...row }) => ({
    ...row,
    adventureName: adventure.name,
    fetchedAt: basicFetchedAt
  }))
}

export function readAdventureCharacters(
  client: DatabaseClient,
  adventureName: string
): Promise<StoredCharacter[]> {
  return readStoredCharacters(client, { adventure: { name: adventureName } })
}

export async function readGuild(client: DatabaseClient, guildId: string): Promise<StoredGuild> {
  // 길드 ID는 서버가 달라도 같은 길드라 서버로 거르지 않는다.
  const members = await readStoredCharacters(client, { guildId })
  // 길드 이름이 바뀌면 다시 받기 전의 길드원 행에는 옛 이름이 남아 있어 가장 최근에 받은 행의 이름을 쓴다.
  const fetchedTime = (member: StoredCharacter) => member.fetchedAt?.getTime() ?? 0
  const [latest] = members.toSorted((left, right) => fetchedTime(right) - fetchedTime(left))
  const guildName = latest?.guildName ?? null

  return { guildName, members }
}
