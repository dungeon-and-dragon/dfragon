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

export async function recordCharacterActive(
  client: DatabaseClient,
  { serverId, characterId }: CollectedCharacter,
  lastActiveAt: Date
): Promise<void> {
  await client.character.updateMany({
    where: { serverId, characterId },
    data: { lastActiveAt, inactiveSince: null }
  })
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
