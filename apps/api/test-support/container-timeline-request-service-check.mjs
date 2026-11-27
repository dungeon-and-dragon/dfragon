import assert from 'node:assert/strict'
import {
  createDatabaseClient,
  readDatabaseConfiguration,
  recordTimelineSyncSuccess,
  replaceEnhancementBackfillRange
} from '@dfragon/database'
import { DatabaseTimelineSyncRequestRepository } from './dist/infrastructure/database/character-timeline.js'
import { TimelineSyncRequestService } from './dist/application/character-timeline/sync-requests.js'

// 합성 캐릭터다.
const seasonStart = new Date('2026-01-01T00:00:00+09:00')
const client = createDatabaseClient(readDatabaseConfiguration(process.env))

try {
  const requests = new TimelineSyncRequestService(
    new DatabaseTimelineSyncRequestRepository(client),
    { now: () => new Date() }
  )

  const requestRows = async (characterId) =>
    client.$queryRaw`
      SELECT "kind", "awaited_at" IS NOT NULL AS "awaited", "started_at" IS NULL AS "waiting"
      FROM "timeline_sync_requests" WHERE "character_id" = ${characterId} ORDER BY "kind"`

  // 1시간 안에 성공한 캐릭터의 정기 동기화와 중천 직전 분까지 받은 캐릭터의 강화 백필은 넣지 않는다.
  const recent = { serverId: 'cain', characterId: 'timeline-request-recent-success' }
  const backfilled = { serverId: 'cain', characterId: 'timeline-request-backfilled' }

  await recordTimelineSyncSuccess(client, recent)
  await replaceEnhancementBackfillRange(
    client,
    backfilled,
    {
      start: new Date('2024-12-01T00:00:00+09:00'),
      end: new Date('2025-01-09T05:59:00+09:00')
    },
    [402],
    [],
    []
  )
  await requests.request([recent, backfilled], { enhancementBackfill: true })
  assert.deepEqual(await requestRows(recent.characterId), [
    { kind: 'enhancement-backfill', awaited: false, waiting: true }
  ])
  assert.deepEqual(await requestRows(backfilled.characterId), [
    { kind: 'sync', awaited: false, waiting: true }
  ])

  // 옛 시즌 받기 요청 행이 남은 시즌만 그 요청을 넣은 캐릭터들에게 받는 중이다.
  await requests.requestSeasonBackfill([
    { character: recent, seasonId: 9, range: { start: seasonStart, end: seasonStart } }
  ])
  assert.deepEqual([...(await requests.readSeasonBackfillRunning([backfilled, recent]))], [9])
  assert.deepEqual([...(await requests.readSeasonBackfillRunning([backfilled]))], [])
  await client.$executeRaw`DELETE FROM "timeline_sync_requests"`
} finally {
  await client.$disconnect()
}
