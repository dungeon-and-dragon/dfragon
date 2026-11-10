import { type CharacterBasicInput, writeCharacter } from './character.js'
import type { DatabaseClient } from './client.js'

export type CollectedCharacter = {
  serverId: string
  characterId: string
}

export async function enqueueCollectedCharacters(
  client: DatabaseClient,
  characters: readonly CollectedCharacter[]
): Promise<void> {
  const serverIds = characters.map((character) => character.serverId)
  const characterIds = characters.map((character) => character.characterId)

  // 같은 목록을 다시 넣어도 기본 정보를 저장한 캐릭터는 대기열에 돌아오지 않게 characters를 함께 본다.
  await client.$executeRaw`
    INSERT INTO "character_collection" ("server_id", "character_id")
    SELECT DISTINCT listed.server_id, listed.character_id
    FROM unnest(${serverIds}::text[], ${characterIds}::text[]) AS listed(server_id, character_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM "characters"
      WHERE "characters"."server_id" = listed.server_id
        AND "characters"."character_id" = listed.character_id
        AND "characters"."basic_fetched_at" IS NOT NULL
    )
    ON CONFLICT DO NOTHING`
}

export async function takeCollectionBatch(
  client: DatabaseClient,
  limit: number
): Promise<CollectedCharacter[]> {
  return client.characterCollection.findMany({
    where: { failure: null },
    orderBy: [{ queuedAt: 'asc' }, { serverId: 'asc' }, { characterId: 'asc' }],
    take: limit,
    select: { serverId: true, characterId: true }
  })
}

export async function recordCharacterBasic(
  client: DatabaseClient,
  basic: CharacterBasicInput
): Promise<void> {
  const { serverId, characterId, adventureName, ...details } = basic

  await client.$transaction(async (transaction) => {
    await writeCharacter(transaction, basic, { ...details, basicFetchedAt: new Date() })
    await transaction.characterCollection.deleteMany({ where: { serverId, characterId } })
  })
}

export async function recordCollectionFailure(
  client: DatabaseClient,
  character: CollectedCharacter,
  failure: string
): Promise<void> {
  const { serverId, characterId } = character

  await client.characterCollection.updateMany({
    where: { serverId, characterId },
    data: { attemptedAt: new Date(), failure }
  })
}

export type CollectionFailureCount = {
  failure: string
  count: number
  lastAttemptedAt: Date | null
}

export type CollectionSummary = {
  waiting: number
  oldestQueuedAt: Date | null
  failures: CollectionFailureCount[]
}

export async function readCollectionSummary(client: DatabaseClient): Promise<CollectionSummary> {
  const groups = await client.characterCollection.groupBy({
    by: ['failure'],
    _count: { _all: true },
    _min: { queuedAt: true },
    _max: { attemptedAt: true }
  })
  const waitingGroup = groups.find((group) => group.failure === null)
  const waiting = waitingGroup?._count._all ?? 0
  const oldestQueuedAt = waitingGroup?._min.queuedAt ?? null
  const failures = groups
    .flatMap(({ failure, _count, _max }) => {
      if (failure === null) {
        return []
      }

      return [{ failure, count: _count._all, lastAttemptedAt: _max.attemptedAt }]
    })
    .sort((a, b) => a.failure.localeCompare(b.failure))

  return { waiting, oldestQueuedAt, failures }
}

export async function requeueCollectionFailures(
  client: DatabaseClient,
  failure: string | undefined
): Promise<number> {
  const { count } = await client.characterCollection.updateMany({
    where: { failure: failure ?? { not: null } },
    data: { failure: null, attemptedAt: null }
  })

  return count
}
