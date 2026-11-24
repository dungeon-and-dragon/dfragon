import type { DatabaseClient } from './client.js'

export const TIMELINE_SYNC_REQUEST_KINDS = [
  'sync',
  'enhancement-backfill',
  'season-backfill'
] as const

export type TimelineSyncRequestKind = (typeof TIMELINE_SYNC_REQUEST_KINDS)[number]

export type TimelineSyncRequest = {
  kind: TimelineSyncRequestKind
  serverId: string
  characterId: string
  seasonId: number
}

export type TimelineSyncRequestCount = {
  kind: TimelineSyncRequestKind
  waiting: number
  running: number
}

export async function requestTimelineSync(
  client: DatabaseClient,
  requests: readonly TimelineSyncRequest[],
  { awaited }: { awaited: boolean }
): Promise<void> {
  const kinds = requests.map(({ kind }) => kind)
  const serverIds = requests.map(({ serverId }) => serverId)
  const characterIds = requests.map(({ characterId }) => characterId)
  const seasonIds = requests.map(({ seasonId }) => seasonId)

  if (!awaited) {
    await client.$executeRaw`
      INSERT INTO "timeline_sync_requests" ("kind", "server_id", "character_id", "season_id")
      SELECT DISTINCT requested.kind, requested.server_id, requested.character_id, requested.season_id
      FROM unnest(${kinds}::text[], ${serverIds}::text[], ${characterIds}::text[], ${seasonIds}::int[])
        AS requested(kind, server_id, character_id, season_id)
      ON CONFLICT DO NOTHING`

    return
  }

  // 이미 기다리던 요청은 기다린 시각만 채워 앞줄로 옮긴다. 같은 행을 두 번 바꾸면 ON CONFLICT DO UPDATE가 실패해 DISTINCT로 합친다.
  await client.$executeRaw`
    INSERT INTO "timeline_sync_requests" ("kind", "server_id", "character_id", "season_id", "awaited_at")
    SELECT DISTINCT requested.kind, requested.server_id, requested.character_id, requested.season_id, now()
    FROM unnest(${kinds}::text[], ${serverIds}::text[], ${characterIds}::text[], ${seasonIds}::int[])
      AS requested(kind, server_id, character_id, season_id)
    ON CONFLICT ("kind", "server_id", "character_id", "season_id") DO UPDATE
      SET "awaited_at" = EXCLUDED."awaited_at"
      WHERE "timeline_sync_requests"."awaited_at" IS NULL`
}

// 정렬과 조건이 timeline_sync_requests_pending_idx와 같아 Sort 없이 index 순서대로 집는다.
export function claimTimelineSyncRequests(
  client: DatabaseClient,
  kind: TimelineSyncRequestKind,
  limit: number
): Promise<TimelineSyncRequest[]> {
  return client.$queryRaw<TimelineSyncRequest[]>`
    UPDATE "timeline_sync_requests" AS request SET "started_at" = now()
    FROM (
      SELECT "kind", "server_id", "character_id", "season_id"
      FROM "timeline_sync_requests"
      WHERE "kind" = ${kind} AND "started_at" IS NULL
      ORDER BY ("awaited_at" IS NULL), "requested_at"
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    ) AS picked
    WHERE request."kind" = picked."kind"
      AND request."server_id" = picked."server_id"
      AND request."character_id" = picked."character_id"
      AND request."season_id" = picked."season_id"
    RETURNING request."kind", request."server_id" AS "serverId",
      request."character_id" AS "characterId", request."season_id" AS "seasonId"`
}

export async function deleteTimelineSyncRequest(
  client: DatabaseClient,
  request: TimelineSyncRequest
): Promise<void> {
  await client.timelineSyncRequest.deleteMany({ where: request })
}

export async function releaseTimelineSyncRequest(
  client: DatabaseClient,
  request: TimelineSyncRequest
): Promise<void> {
  await client.timelineSyncRequest.updateMany({ where: request, data: { startedAt: null } })
}

export async function releaseStartedTimelineSyncRequests(client: DatabaseClient): Promise<void> {
  await client.timelineSyncRequest.updateMany({
    where: { startedAt: { not: null } },
    data: { startedAt: null }
  })
}

export async function countTimelineSyncRequests(
  client: DatabaseClient
): Promise<TimelineSyncRequestCount[]> {
  const rows = await client.$queryRaw<TimelineSyncRequestCount[]>`
    SELECT "kind",
      count(*) FILTER (WHERE "started_at" IS NULL)::int AS "waiting",
      count(*) FILTER (WHERE "started_at" IS NOT NULL)::int AS "running"
    FROM "timeline_sync_requests"
    GROUP BY "kind"`

  const counts = new Map(rows.map((row) => [row.kind, row]))

  return TIMELINE_SYNC_REQUEST_KINDS.map((kind) => {
    const count = counts.get(kind)

    if (count === undefined) {
      return { kind, waiting: 0, running: 0 }
    }

    return count
  })
}
