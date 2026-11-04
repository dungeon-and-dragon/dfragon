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
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(${timelineLockNamespace}::int, hashtext(${`${serverId}/${characterId}`}))`
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
        data: items.map((item) => ({
          serverId,
          characterId,
          code: item.code,
          occurredAt: item.occurredAt,
          name: item.name,
          itemId: item.itemId,
          itemName: item.itemName,
          itemRarity: item.itemRarity,
          data: toJson(item.data)
        }))
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
