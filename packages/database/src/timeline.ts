import type { DatabaseClient } from './client.js'
import type { Prisma } from './generated/prisma/client.js'

export type TimelineEventInput = {
  code: number
  occurredAt: Date
  name: string
  raidName: string | null
  data: Record<string, unknown>
}

export type TimelineItemInput = {
  code: number
  occurredAt: Date
  name: string
  itemId: string | null
  itemName: string | null
  itemRarity: string | null
  data: Record<string, unknown>
}

export type TimelineCharacter = {
  serverId: string
  characterId: string
}

export type TimelineRange = {
  start: Date
  end: Date
}

export type TimelineSyncState = {
  syncedUntil: Date | null
  lastSucceededAt: Date | null
}

export type TimelineEventRow = {
  code: number
  occurredAt: Date
  name: string
  raidName: string | null
  data: unknown
}

export type TimelineItemRow = {
  code: number
  occurredAt: Date
  name: string
  itemId: string | null
  itemName: string | null
  itemRarity: string | null
  data: unknown
}

export type CharacterTimelineEventRow = TimelineCharacter & TimelineEventRow

export type RecentTimelineItemQuery = {
  codes: readonly number[]
  itemRarities?: readonly string[]
  limit: number
}

// pg_advisory_xact_lock(int, int)는 Prisma migrate의 단일 bigint key와 다른 lock 공간을 쓴다.
// 캐릭터 hash가 겹치면 다른 캐릭터의 교체가 잠깐 기다릴 뿐 결과는 같다.
const timelineLockNamespace = 1175
// Prisma interactive transaction의 기본 5초에는 lock 대기도 들어간다. 로컬 PostgreSQL 18.6에서
// items 1만 행 교체가 약 1초, 5만 행이 약 5초 걸렸다. 같은 캐릭터 교체 하나를 기다려도 끝나게 둔다.
const replaceTimeout = 60_000

function isInRange(occurredAt: Date, range: TimelineRange): boolean {
  return occurredAt >= range.start && occurredAt <= range.end
}

function toJson(data: Record<string, unknown>): Prisma.InputJsonObject {
  // Neople 응답 JSON에서 꺼낸 객체라 JSON 값만 담는다.
  return data as Prisma.InputJsonObject
}

function lockCharacter(
  transaction: Prisma.TransactionClient,
  { serverId, characterId }: TimelineCharacter
): Promise<unknown> {
  return transaction.$executeRaw`SELECT pg_advisory_xact_lock(${timelineLockNamespace}::int, hashtext(${`${serverId}/${characterId}`}))`
}

function toItemData({ serverId, characterId }: TimelineCharacter, item: TimelineItemInput) {
  return {
    serverId,
    characterId,
    code: item.code,
    occurredAt: item.occurredAt,
    name: item.name,
    itemId: item.itemId,
    itemName: item.itemName,
    itemRarity: item.itemRarity,
    data: toJson(item.data)
  }
}

export async function replaceTimelineRange(
  client: DatabaseClient,
  character: TimelineCharacter,
  range: TimelineRange,
  events: readonly TimelineEventInput[],
  items: readonly TimelineItemInput[]
): Promise<void> {
  // 구간 밖 행을 넣으면 그 구간을 교체할 때 지워지지 않고 두 번 들어간다.
  if (![...events, ...items].every((row) => isInRange(row.occurredAt, range))) {
    throw new RangeError('Timeline row outside replaced range')
  }
  const { serverId, characterId } = character
  const occurredAt = { gte: range.start, lte: range.end }

  await client.$transaction(
    async (transaction) => {
      // 같은 캐릭터의 교체가 겹치면 둘 다 지운 뒤 넣어 행이 두 번 들어가므로 지우기 전에 잡는다.
      await lockCharacter(transaction, character)
      await transaction.timelineEvent.deleteMany({ where: { serverId, characterId, occurredAt } })
      await transaction.timelineItem.deleteMany({ where: { serverId, characterId, occurredAt } })
      await transaction.timelineEvent.createMany({
        data: events.map((event) => ({
          serverId,
          characterId,
          code: event.code,
          occurredAt: event.occurredAt,
          name: event.name,
          raidName: event.raidName,
          data: toJson(event.data)
        }))
      })
      await transaction.timelineItem.createMany({
        data: items.map((item) => toItemData(character, item))
      })
      await transaction.timelineSyncState.upsert({
        where: { serverId_characterId: { serverId, characterId } },
        create: { serverId, characterId, syncedUntil: range.end },
        update: { syncedUntil: range.end }
      })
    },
    { timeout: replaceTimeout }
  )
}

export async function replaceEnhancementBackfillRange(
  client: DatabaseClient,
  character: TimelineCharacter,
  range: TimelineRange,
  codes: readonly number[],
  items: readonly TimelineItemInput[]
): Promise<void> {
  // 백필 코드가 아닌 행을 넣으면 정기 동기화가 받은 같은 구간의 행과 겹쳐도 지워지지 않는다.
  if (!items.every((item) => isInRange(item.occurredAt, range) && codes.includes(item.code))) {
    throw new RangeError('Timeline row outside replaced backfill')
  }
  const { serverId, characterId } = character
  const occurredAt = { gte: range.start, lte: range.end }

  await client.$transaction(
    async (transaction) => {
      await lockCharacter(transaction, character)
      await transaction.timelineItem.deleteMany({
        where: { serverId, characterId, code: { in: [...codes] }, occurredAt }
      })
      await transaction.timelineItem.createMany({
        data: items.map((item) => toItemData(character, item))
      })
      await transaction.timelineSyncState.upsert({
        where: { serverId_characterId: { serverId, characterId } },
        create: { serverId, characterId, enhancementBackfilledUntil: range.end },
        update: { enhancementBackfilledUntil: range.end }
      })
    },
    { timeout: replaceTimeout }
  )
}

export async function readEnhancementBackfilledUntil(
  client: DatabaseClient,
  { serverId, characterId }: TimelineCharacter
): Promise<Date | null> {
  const state = await client.timelineSyncState.findUnique({
    where: { serverId_characterId: { serverId, characterId } },
    select: { enhancementBackfilledUntil: true }
  })

  if (state === null) {
    return null
  }

  return state.enhancementBackfilledUntil
}

export async function readTimelineSyncState(
  client: DatabaseClient,
  character: TimelineCharacter
): Promise<TimelineSyncState | undefined> {
  const { serverId, characterId } = character
  const state = await client.timelineSyncState.findUnique({
    where: { serverId_characterId: { serverId, characterId } },
    select: { syncedUntil: true, lastSucceededAt: true }
  })

  if (state === null) {
    return undefined
  }

  return state
}

export async function recordTimelineSyncSuccess(
  client: DatabaseClient,
  character: TimelineCharacter
): Promise<void> {
  const { serverId, characterId } = character
  const now = new Date()
  const result = { lastAttemptedAt: now, lastSucceededAt: now, lastFailure: null }
  await client.timelineSyncState.upsert({
    where: { serverId_characterId: { serverId, characterId } },
    create: { serverId, characterId, ...result },
    update: result
  })
}

export async function recordTimelineSyncFailure(
  client: DatabaseClient,
  character: TimelineCharacter,
  failure: string
): Promise<void> {
  const { serverId, characterId } = character
  const result = { lastAttemptedAt: new Date(), lastFailure: failure }
  await client.timelineSyncState.upsert({
    where: { serverId_characterId: { serverId, characterId } },
    create: { serverId, characterId, ...result },
    update: result
  })
}

export async function readCurrentSeasonStart(
  client: DatabaseClient,
  now: Date
): Promise<Date | undefined> {
  const season = await client.season.findFirst({
    where: { startsAt: { lte: now } },
    orderBy: { startsAt: 'desc' },
    select: { startsAt: true }
  })

  return season?.startsAt
}

export function readTimelineEvents(
  client: DatabaseClient,
  character: TimelineCharacter,
  codes: readonly number[],
  since: Date
): Promise<TimelineEventRow[]> {
  const { serverId, characterId } = character

  return client.timelineEvent.findMany({
    where: { serverId, characterId, code: { in: [...codes] }, occurredAt: { gte: since } },
    orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
    select: { code: true, occurredAt: true, name: true, raidName: true, data: true }
  })
}

export function readCharactersTimelineEvents(
  client: DatabaseClient,
  characters: readonly TimelineCharacter[],
  codes: readonly number[],
  since: Date
): Promise<CharacterTimelineEventRow[]> {
  return client.timelineEvent.findMany({
    where: {
      OR: characters.map(({ serverId, characterId }) => ({ serverId, characterId })),
      code: { in: [...codes] },
      occurredAt: { gte: since }
    },
    orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
    select: {
      serverId: true,
      characterId: true,
      code: true,
      occurredAt: true,
      name: true,
      raidName: true,
      data: true
    }
  })
}

export function readRecentTimelineItems(
  client: DatabaseClient,
  character: TimelineCharacter,
  { codes, itemRarities, limit }: RecentTimelineItemQuery
): Promise<TimelineItemRow[]> {
  const { serverId, characterId } = character

  return client.timelineItem.findMany({
    where: {
      serverId,
      characterId,
      code: { in: [...codes] },
      itemRarity: itemRarities && { in: [...itemRarities] }
    },
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    take: limit,
    select: {
      code: true,
      occurredAt: true,
      name: true,
      itemId: true,
      itemName: true,
      itemRarity: true,
      data: true
    }
  })
}
