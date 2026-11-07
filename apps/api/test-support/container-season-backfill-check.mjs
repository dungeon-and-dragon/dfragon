import assert from 'node:assert/strict'
import {
  createDatabaseClient,
  readDatabaseConfiguration,
  readSeasonBackfillStates,
  recordSeasonBackfillCompleted,
  replaceSeasonBackfillRange
} from '@dfragon/database'

// 합성 캐릭터와 타임라인이다. 귀환(시즌 7) 첫 90일 구간과 다음 구간을 받는다.
const season = 7
const at = (time) => new Date(`${time}+09:00`)
const first = { start: at('2020-01-09T06:00:00'), end: at('2020-04-08T06:00:00') }
const second = { start: first.end, end: at('2020-07-07T06:00:00') }
const target = { serverId: 'cain', characterId: 'season-backfill' }
// target보다 나중에 저장하지만 서버 순으로는 앞선다.
const other = { serverId: 'anton', characterId: 'season-backfill-other' }
const unlisted = { serverId: 'cain', characterId: 'season-backfill-unlisted' }
const syncState = {
  syncedUntil: at('2026-04-01T00:00:00'),
  enhancementBackfilledUntil: at('2020-02-01T00:00:00')
}
const event = (code, occurredAt, name) => ({
  code,
  occurredAt,
  name,
  raidName: null,
  data: {}
})
const item = (code, occurredAt, name) => ({
  code,
  occurredAt,
  name,
  itemId: null,
  itemName: null,
  itemRarity: null,
  data: {}
})
const row = ({ code, occurredAt, name }) => `${code}:${occurredAt.toISOString()}:${name}`
const characterRows = async (model, character) =>
  (
    await model.findMany({
      where: character,
      orderBy: { occurredAt: 'asc' },
      select: { code: true, occurredAt: true, name: true }
    })
  ).map(row)

const client = createDatabaseClient(readDatabaseConfiguration(process.env))
try {
  await client.timelineSyncState.create({ data: { ...target, ...syncState } })
  const beforeFirst = item(505, at('2020-01-09T05:59:00'), 'kept-before')
  const afterFirst = item(505, at('2020-04-08T06:01:00'), 'kept-after')
  // 강화 백필이 넣은 행이다. 같은 구간을 받으면 Neople이 다시 주는 행으로 바뀌어야 한다.
  const enhancement = item(402, at('2020-02-01T00:00:00'), 'enhancement-backfill')
  const otherItem = item(505, at('2020-02-01T00:00:00'), 'kept-other')
  await client.timelineItem.createMany({
    data: [
      { ...target, ...beforeFirst },
      { ...target, ...afterFirst },
      { ...target, ...enhancement },
      { ...other, ...otherItem }
    ]
  })
  const staleEvent = event(201, at('2020-03-01T00:00:00'), 'stale')
  const afterFirstEvent = event(201, at('2020-04-08T06:01:00'), 'kept-after')
  const otherEvent = event(201, at('2020-03-01T00:00:00'), 'kept-other')
  await client.timelineEvent.createMany({
    data: [
      { ...target, ...staleEvent },
      { ...target, ...afterFirstEvent },
      { ...other, ...otherEvent }
    ]
  })

  // 구간 양 끝 분도 교체 대상이다.
  const firstEvents = [event(201, first.end, 'first')]
  const firstItems = [
    item(402, first.start, 'first'),
    item(505, at('2020-02-01T00:00:00'), 'first')
  ]
  await replaceSeasonBackfillRange(client, target, season, first, firstEvents, firstItems)
  assert.deepEqual(await characterRows(client.timelineEvent, target), [
    ...firstEvents.map(row),
    row(afterFirstEvent)
  ])
  assert.deepEqual(await characterRows(client.timelineItem, target), [
    row(beforeFirst),
    ...firstItems.map(row),
    row(afterFirst)
  ])
  // other의 남길 행과 겹치지 않는 구간이다.
  await replaceSeasonBackfillRange(client, other, season, second, [], [])
  await replaceSeasonBackfillRange(client, unlisted, season, first, [], [])
  assert.deepEqual(await readSeasonBackfillStates(client, [target, other], season), [
    { ...other, backfilledUntil: second.end, completedAt: null },
    { ...target, backfilledUntil: first.end, completedAt: null }
  ])

  await assert.rejects(
    replaceSeasonBackfillRange(client, target, season, second, [], [item(505, first.start, 'x')]),
    RangeError
  )
  const secondItems = [item(505, at('2020-05-01T00:00:00'), 'second')]
  await replaceSeasonBackfillRange(client, target, season, second, [], secondItems)
  // 앞 구간 끝 분은 두 구간에 모두 들어가므로 뒤 구간이 비우면 지워진다.
  assert.deepEqual(await characterRows(client.timelineEvent, target), [])
  assert.deepEqual(await characterRows(client.timelineItem, target), [
    row(beforeFirst),
    row(firstItems[0]),
    row(firstItems[1]),
    ...secondItems.map(row)
  ])
  assert.deepEqual(await characterRows(client.timelineEvent, other), [row(otherEvent)])
  assert.deepEqual(await characterRows(client.timelineItem, other), [row(otherItem)])

  await recordSeasonBackfillCompleted(client, target, season)
  const [completed] = await readSeasonBackfillStates(client, [target], season)
  assert.equal(completed.backfilledUntil.getTime(), second.end.getTime())
  assert(completed.completedAt instanceof Date)
  assert.deepEqual(await readSeasonBackfillStates(client, [target], season - 1), [])
  await assert.rejects(recordSeasonBackfillCompleted(client, target, season - 1), {
    code: 'P2025'
  })
  assert.deepEqual(
    await client.timelineSyncState.findUnique({
      where: { serverId_characterId: target },
      select: { syncedUntil: true, enhancementBackfilledUntil: true }
    }),
    syncState
  )
} finally {
  for (const character of [target, other, unlisted]) {
    await client.timelineEvent.deleteMany({ where: character })
    await client.timelineItem.deleteMany({ where: character })
    await client.timelineSyncState.deleteMany({ where: character })
    await client.timelineSeasonBackfill.deleteMany({ where: character })
  }
  await client.$disconnect()
}
