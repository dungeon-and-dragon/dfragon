import assert from 'node:assert/strict'
import {
  claimTimelineSyncRequests,
  countTimelineSyncRequests,
  createDatabaseClient,
  deleteTimelineSyncRequest,
  readDatabaseConfiguration,
  releaseStartedTimelineSyncRequests,
  releaseTimelineSyncRequest,
  requestTimelineSync
} from '@dfragon/database'

// 합성 캐릭터다. 같은 밀리초에 넣은 요청은 requested_at이 같을 수 있어 요청 순서를 시각으로 못 박는다.
const sync = (characterId) => ({ kind: 'sync', serverId: 'cain', characterId, seasonId: 0 })
const oldest = sync('request-check-oldest')
const middle = sync('request-check-middle')
const newest = sync('request-check-newest')
const backfill = { ...oldest, kind: 'enhancement-backfill' }
const notAwaited = { awaited: false }
const awaited = { awaited: true }
const characterIds = (requests) => requests.map(({ characterId }) => characterId).sort()

const client = createDatabaseClient(readDatabaseConfiguration(process.env))

try {
  await requestTimelineSync(client, [oldest, middle, newest, newest], notAwaited)
  await requestTimelineSync(client, [backfill], notAwaited)
  await client.$executeRaw`
    UPDATE "timeline_sync_requests"
    SET "requested_at" = now() - (CASE "character_id"
      WHEN 'request-check-oldest' THEN 3 WHEN 'request-check-middle' THEN 2 ELSE 1 END) * interval '1 minute'`

  await requestTimelineSync(client, [newest], awaited)
  const [{ awaitedAt }] = await client.$queryRaw`
    SELECT "awaited_at" AS "awaitedAt" FROM "timeline_sync_requests"
    WHERE "kind" = 'sync' AND "character_id" = 'request-check-newest'`

  assert(awaitedAt instanceof Date)
  await requestTimelineSync(client, [newest], awaited)
  await requestTimelineSync(client, [middle], notAwaited)
  assert.deepEqual(
    await client.$queryRaw`
      SELECT "character_id" AS "characterId", "awaited_at" AS "awaitedAt"
      FROM "timeline_sync_requests" WHERE "kind" = 'sync' ORDER BY "character_id"`,
    [
      { characterId: 'request-check-middle', awaitedAt: null },
      { characterId: 'request-check-newest', awaitedAt },
      { characterId: 'request-check-oldest', awaitedAt: null }
    ]
  )
  assert.deepEqual(await countTimelineSyncRequests(client), [
    { kind: 'sync', waiting: 3, running: 0 },
    { kind: 'enhancement-backfill', waiting: 1, running: 0 },
    { kind: 'season-backfill', waiting: 0, running: 0 }
  ])

  // 타임라인 조회가 기다리는 요청을 먼저, 나머지는 먼저 요청한 순서로 집고, 다른 종류와 이미 집은 행은 집지 않는다.
  const claimedFirst = await claimTimelineSyncRequests(client, 'sync', 2)
  assert.deepEqual(characterIds(claimedFirst), ['request-check-newest', 'request-check-oldest'])
  assert.deepEqual(await claimTimelineSyncRequests(client, 'sync', 2), [middle])
  assert.deepEqual(await claimTimelineSyncRequests(client, 'sync', 2), [])
  assert.deepEqual((await countTimelineSyncRequests(client))[0], {
    kind: 'sync',
    waiting: 0,
    running: 3
  })

  await releaseTimelineSyncRequest(client, oldest)
  assert.deepEqual(await claimTimelineSyncRequests(client, 'sync', 5), [oldest])
  await deleteTimelineSyncRequest(client, newest)
  await releaseStartedTimelineSyncRequests(client)
  assert.deepEqual(await countTimelineSyncRequests(client), [
    { kind: 'sync', waiting: 2, running: 0 },
    { kind: 'enhancement-backfill', waiting: 1, running: 0 },
    { kind: 'season-backfill', waiting: 0, running: 0 }
  ])
  assert.deepEqual(await claimTimelineSyncRequests(client, 'enhancement-backfill', 5), [backfill])

  await client.$executeRaw`DELETE FROM "timeline_sync_requests"`
} finally {
  await client.$disconnect()
}
