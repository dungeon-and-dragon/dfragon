import type { CollectedCharacter } from './character-collection.js'
import type { DatabaseClient } from './client.js'

export type FameRefreshTarget = CollectedCharacter & {
  lastActiveAt: Date | null
}

const FIRST_KEY = { serverId: '', characterId: '' }

export function countFameRefreshTargets(client: DatabaseClient): Promise<number> {
  return client.character.count({ where: { inactiveSince: null, basicFetchedAt: { not: null } } })
}

export function readFameRefreshTargets(
  client: DatabaseClient,
  after: CollectedCharacter | null,
  limit: number
): Promise<FameRefreshTarget[]> {
  const { serverId, characterId } = after ?? FIRST_KEY

  return client.$queryRaw<FameRefreshTarget[]>`
    SELECT
      server_id AS "serverId",
      character_id AS "characterId",
      last_active_at AS "lastActiveAt"
    FROM characters
    WHERE inactive_since IS NULL
      AND basic_fetched_at IS NOT NULL
      AND (server_id, character_id) > (${serverId}, ${characterId})
    ORDER BY server_id, character_id
    LIMIT ${limit}`
}

export function countInactiveCharacters(client: DatabaseClient): Promise<number> {
  return client.character.count({ where: { inactiveSince: { not: null } } })
}

export function readInactiveCharacters(
  client: DatabaseClient,
  after: CollectedCharacter | null,
  limit: number
): Promise<CollectedCharacter[]> {
  const { serverId, characterId } = after ?? FIRST_KEY

  return client.$queryRaw<CollectedCharacter[]>`
    SELECT server_id AS "serverId", character_id AS "characterId"
    FROM characters
    WHERE inactive_since IS NOT NULL
      AND (server_id, character_id) > (${serverId}, ${characterId})
    ORDER BY server_id, character_id
    LIMIT ${limit}`
}

export type CharacterActivityInput = CollectedCharacter & {
  lastActiveAt: Date
}

export function recordCharacterActive(
  client: DatabaseClient,
  character: CollectedCharacter,
  lastActiveAt: Date
): Promise<void> {
  return recordCharactersActive(client, [{ ...character, lastActiveAt }])
}

// 여러 job이 같은 캐릭터의 타임라인을 따로 받으므로, 늦게 끝난 쪽이 더 오래된 활동 시각으로 덮어쓰지 않게 한다.
export async function recordCharactersActive(
  client: DatabaseClient,
  activities: readonly CharacterActivityInput[]
): Promise<void> {
  if (activities.length === 0) {
    return
  }

  await client.$executeRaw`
    UPDATE characters AS c
    SET last_active_at = GREATEST(c.last_active_at, a.last_active_at),
      inactive_since = NULL
    FROM unnest(
      ${activities.map(({ serverId }) => serverId)}::text[],
      ${activities.map(({ characterId }) => characterId)}::text[],
      ${activities.map(({ lastActiveAt }) => lastActiveAt)}::timestamptz[]
    ) AS a(server_id, character_id, last_active_at)
    WHERE c.server_id = a.server_id
      AND c.character_id = a.character_id`
}

export async function recordCharacterInactive(
  client: DatabaseClient,
  { serverId, characterId }: CollectedCharacter,
  inactiveSince: Date
): Promise<void> {
  await client.character.updateMany({
    where: { serverId, characterId },
    data: { inactiveSince }
  })
}
