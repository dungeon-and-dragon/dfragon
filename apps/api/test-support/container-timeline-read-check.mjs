import assert from 'node:assert/strict'
import { setTimeout } from 'node:timers/promises'
import {
  createDatabaseClient,
  deleteTimelineSyncRequest,
  readDatabaseConfiguration,
  recordTimelineSyncSuccess,
  replaceEnhancementBackfillRange,
  replaceTimelineRange
} from '@dfragon/database'
import { readCharacterTimeline } from './dist/infrastructure/database/character-timeline-read.js'
import { DatabaseTimelineSyncRequestRepository } from './dist/infrastructure/database/character-timeline.js'
import { CharacterTimelineService } from './dist/application/character-timeline/service.js'
import { TimelineSyncRequestService } from './dist/application/character-timeline/sync-requests.js'

// 합성 캐릭터와 타임라인이다. 천해천(2026-03-26 06:00+09) 둘째 주 목요일 정오에 읽는다.
const now = new Date('2026-04-02T12:00:00+09:00')
const weekStart = new Date('2026-04-02T06:00:00+09:00')
const range = { start: new Date('2026-01-01T00:00:00+09:00'), end: now }
const at = (time) => new Date(`2026-${time}+09:00`)
const raid = (code, occurredAt, raidName, data = {}) => ({
  code,
  occurredAt,
  name: '레이드',
  raidName,
  data
})
const item = (code, occurredAt, itemRarity, data = {}) => ({
  code,
  occurredAt,
  name: '아이템 획득(던전 드랍)',
  itemId: `synthetic-${code}`,
  itemName: '합성 아이템',
  itemRarity,
  data
})
const diregie = { modeName: '디레지에 : 악연', hard: true }
const events = [
  raid(201, at('03-26T05:59:00'), '디레지에 레이드', diregie),
  raid(201, at('03-26T06:00:00'), '디레지에 레이드', diregie),
  raid(201, at('04-02T05:59:00'), '디레지에 레이드', { modeName: '디레지에 : 악연' }),
  raid(201, weekStart, '디레지에 레이드', diregie),
  raid(210, at('04-02T07:00:00'), '이내 황혼전'),
  { ...raid(209, at('04-02T08:00:00'), null, { regionName: '베누스' }), name: '레기온' },
  raid(202, at('04-02T09:00:00'), '합성 던전')
]
const amplifies = Array.from({ length: 51 }, (_, index) =>
  item(402, new Date(range.start.getTime() + index * 60_000), '에픽', {
    safe: false,
    after: index + 1,
    before: index,
    result: true
  })
)
const items = [
  ...amplifies,
  item(403, at('04-01T10:00:00'), '유니크', { after: 8, result: true }),
  item(505, at('04-01T11:00:00'), '에픽'),
  item(505, at('04-01T11:01:00'), '레전더리'),
  item(513, at('04-01T11:02:00'), '태초'),
  item(550, at('04-01T11:03:00'), '언커먼'),
  item(601, at('04-01T11:04:00'), '에픽')
]
const stored = { serverId: 'cain', characterId: 'timeline-read' }
const empty = { serverId: 'cain', characterId: 'timeline-empty' }
const waited = { serverId: 'cain', characterId: 'timeline-waited' }
const client = createDatabaseClient(readDatabaseConfiguration(process.env))
try {
  await replaceTimelineRange(client, stored, range, events, items)

  const timeline = await readCharacterTimeline(client, stored, now)

  assert.deepEqual(timeline.weeklyClears, [
    {
      kind: 'raid',
      name: '디레지에 레이드',
      modeName: '디레지에 : 악연',
      hard: true,
      occurredAt: weekStart
    },
    {
      kind: 'raid',
      name: '이내 황혼전',
      modeName: null,
      hard: false,
      occurredAt: at('04-02T07:00:00')
    },
    {
      kind: 'legion',
      name: '베누스',
      modeName: null,
      hard: false,
      occurredAt: at('04-02T08:00:00')
    }
  ])
  assert.deepEqual(timeline.seasonClears, [
    { kind: 'raid', name: '디레지에 레이드', hard: true, count: 2 },
    { kind: 'raid', name: '디레지에 레이드', hard: false, count: 1 },
    { kind: 'raid', name: '이내 황혼전', hard: false, count: 1 },
    { kind: 'legion', name: '베누스', hard: false, count: 1 }
  ])
  assert.equal(timeline.enhancements.length, 50)
  assert.deepEqual(timeline.enhancements[0], {
    kind: 'refine',
    itemId: 'synthetic-403',
    itemName: '합성 아이템',
    itemRarity: '유니크',
    before: null,
    after: 8,
    result: true,
    safe: null,
    occurredAt: at('04-01T10:00:00')
  })
  assert.deepEqual(
    timeline.enhancements.slice(1).map(({ kind, after }) => `${kind}:${after}`),
    Array.from({ length: 49 }, (_, index) => `amplify:${51 - index}`)
  )
  assert.deepEqual(
    timeline.acquisitions.map(({ code, itemRarity }) => `${code}:${itemRarity}`),
    ['513:태초', '505:에픽']
  )

  assert.deepEqual(await readCharacterTimeline(client, empty, now), {
    weeklyClears: [],
    seasonClears: [],
    enhancements: [],
    acquisitions: [],
    enhancementsCursor: null,
    acquisitionsCursor: null
  })

  // 요청 행을 지우는 worker는 이 검사가 흉내 낸다.
  const requests = new TimelineSyncRequestService(
    new DatabaseTimelineSyncRequestRepository(client),
    {
      now: () => new Date(),
      pause: setTimeout
    }
  )
  const requestRows = async (characterId) =>
    client.$queryRaw`
      SELECT "kind", "awaited_at" IS NOT NULL AS "awaited", "started_at" IS NULL AS "waiting"
      FROM "timeline_sync_requests" WHERE "character_id" = ${characterId} ORDER BY "kind"`
  let readStarted = false
  const service = new CharacterTimelineService(
    {
      readTimeline: (character) => {
        readStarted = true

        return readCharacterTimeline(client, character, now)
      }
    },
    requests
  )
  const answer = service.get(waited)

  while ((await requestRows(waited.characterId)).length === 0) {
    await setTimeout(50)
  }

  assert.deepEqual(await requestRows(waited.characterId), [
    { kind: 'sync', awaited: true, waiting: true }
  ])
  assert.equal(readStarted, false)
  await replaceTimelineRange(client, waited, range, [raid(201, weekStart, '합성 레이드')], [])
  await deleteTimelineSyncRequest(client, { kind: 'sync', ...waited, seasonId: 0 })

  assert.deepEqual((await answer).weeklyClears, [
    { kind: 'raid', name: '합성 레이드', modeName: null, hard: false, occurredAt: weekStart }
  ])

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
    { character: recent, seasonId: 9, range: { start: range.start, end: range.start } }
  ])
  assert.deepEqual([...(await requests.readSeasonBackfillRunning([backfilled, recent]))], [9])
  assert.deepEqual([...(await requests.readSeasonBackfillRunning([backfilled]))], [])
  await client.$executeRaw`DELETE FROM "timeline_sync_requests"`
} finally {
  await client.$disconnect()
}
