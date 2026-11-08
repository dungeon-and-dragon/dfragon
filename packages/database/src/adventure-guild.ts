import type { DatabaseClient } from './client.js'
import { Prisma } from './generated/prisma/client.js'
import { learnedDealerSkillSql } from './male-crusader.js'

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
  dealerSkillLearned: boolean | null
}

export type StoredAdventureName = {
  serverId: string
  characterId: string
  adventureName: string
}

export type StoredGuild = {
  guildName: string | null
  members: StoredCharacter[]
}

// 전직을 바꾼 뒤 아직 다시 받지 않은 캐릭터는 예전 전직의 스킬이 남아 있어 스킬 스타일 행이 없는 것으로 본다.
// JOIN으로 쓰면 planner가 스킬 스타일 테이블을 먼저 다 읽어 명성 index 순서로 앞부분만 읽지 못하므로, 행마다 PK로 읽는 subquery로 둔다.
export const storedDealerSkillLearnedSql = Prisma.sql`(
  SELECT ${learnedDealerSkillSql(Prisma.sql`style.skills`)}
  FROM character_skill_styles style
  WHERE style.server_id = c.server_id
    AND style.character_id = c.character_id
    AND style.job_id = c.job_id
    AND style.job_grow_id = c.job_grow_id
)`

export function readStoredCharacterRows(
  client: DatabaseClient,
  filterAndOrder: Prisma.Sql
): Promise<StoredCharacter[]> {
  return client.$queryRaw<StoredCharacter[]>`
    SELECT
      c.server_id AS "serverId",
      c.character_id AS "characterId",
      c.character_name AS "characterName",
      a.name AS "adventureName",
      c.level,
      c.job_id AS "jobId",
      c.job_grow_id AS "jobGrowId",
      c.job_name AS "jobName",
      c.job_grow_name AS "jobGrowName",
      c.fame,
      c.guild_id AS "guildId",
      c.guild_name AS "guildName",
      c.basic_fetched_at AS "fetchedAt",
      ${storedDealerSkillLearnedSql} AS "dealerSkillLearned"
    FROM characters c
    JOIN adventures a ON a.id = c.adventure_id
    ${filterAndOrder}`
}

function readStoredCharacters(
  client: DatabaseClient,
  condition: Prisma.Sql
): Promise<StoredCharacter[]> {
  return readStoredCharacterRows(
    client,
    Prisma.sql`WHERE ${condition} ORDER BY c.fame DESC NULLS LAST, c.server_id, c.character_id`
  )
}

export function readAdventureCharacters(
  client: DatabaseClient,
  adventureName: string
): Promise<StoredCharacter[]> {
  return readStoredCharacters(client, Prisma.sql`a.name = ${adventureName}`)
}

export async function readAdventureNames(
  client: DatabaseClient,
  characters: readonly { serverId: string; characterId: string }[]
): Promise<StoredAdventureName[]> {
  const rows = await client.character.findMany({
    where: { OR: characters.map(({ serverId, characterId }) => ({ serverId, characterId })) },
    select: { serverId: true, characterId: true, adventure: { select: { name: true } } }
  })

  return rows.map(({ adventure, ...row }) => ({ ...row, adventureName: adventure.name }))
}

export async function readGuild(client: DatabaseClient, guildId: string): Promise<StoredGuild> {
  // 길드 ID는 서버가 달라도 같은 길드라 서버로 거르지 않는다.
  const members = await readStoredCharacters(client, Prisma.sql`c.guild_id = ${guildId}`)
  // 길드 이름이 바뀌면 다시 받기 전의 길드원 행에는 옛 이름이 남아 있어 가장 최근에 받은 행의 이름을 쓴다.
  const fetchedTime = (member: StoredCharacter) => member.fetchedAt?.getTime() ?? 0
  const [latest] = members.toSorted((left, right) => fetchedTime(right) - fetchedTime(left))
  const guildName = latest?.guildName ?? null

  return { guildName, members }
}
