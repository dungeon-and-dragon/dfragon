import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  createDatabaseClient,
  readEnhancementBackfilledUntil,
  replaceEnhancementBackfillRange,
  replaceSeasonBackfillRange
} from '../dist/index.js'

const port = process.env.DFRAGON_TEST_TIMELINE_PORT
const restartMigration = '20261117130000_restart_enhancement_backfill'
const migrationsDirectory = new URL('../prisma/migrations/', import.meta.url)
const backfillCodes = [102, 105, 401, 402, 403]

const connect = (database) =>
  createDatabaseClient({
    host: '127.0.0.1',
    port: Number(port),
    database,
    username: 'timeline_test',
    password: 'synthetic'
  })

async function recreateDatabase(database) {
  const admin = connect('timeline_test')

  try {
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${database}"`)
    await admin.$executeRawUnsafe(`CREATE DATABASE "${database}"`)
  } finally {
    await admin.$disconnect()
  }
}

async function runMigration(client, name) {
  const sql = await readFile(new URL(`${name}/migration.sql`, migrationsDirectory), 'utf8')

  for (const statement of sql
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)) {
    await client.$executeRawUnsafe(statement)
  }
}

async function migrationNames() {
  return (await readdir(migrationsDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map(({ name }) => name)
    .toSorted()
}

async function runMigrationsBefore(client, until) {
  for (const name of (await migrationNames()).filter((name) => name < until)) {
    await runMigration(client, name)
  }
}

// 옛 시즌 받기가 처음 본 클리어 시각 테이블도 갱신해 마지막 migration까지 적용한다.
async function migratedDatabase(t, database) {
  await recreateDatabase(database)
  const client = connect(database)
  t.after(() => client.$disconnect())

  for (const name of await migrationNames()) {
    await runMigration(client, name)
  }

  return client
}

// 합성 캐릭터와 타임라인 행이다. 실제 캐릭터, Neople 응답과 관계없다.
const character = { serverId: 'cain', characterId: 'name-backfill' }
const at = (time) => new Date(`${time}+09:00`)
const event = (code, occurredAt, name, data = {}) => ({
  code,
  occurredAt,
  name,
  raidName: null,
  data
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
const nameChange = event(102, at('2020-02-01T00:00:00'), '캐릭터명 변경', {
  beforeName: '합성이전',
  afterName: '합성이후'
})
const adventureNameChange = event(105, at('2020-02-01T12:00:00'), '모험단명 변경', {
  beforeName: '합성모험단',
  afterName: '새합성모험단'
})
const amplify = item(402, at('2020-02-03T00:00:00'), '아이템 증폭')
// 귀환(시즌 7) 첫 90일이다. 강화 백필 구간과 겹친다.
const seasonRange = { start: at('2020-01-09T06:00:00'), end: at('2020-04-08T06:00:00') }
const backfillRange = { start: at('2019-12-01T00:00:00'), end: at('2020-02-29T00:00:00') }

const storedRows = async (client) => {
  const rows = [
    ...(await client.timelineEvent.findMany({ where: character })),
    ...(await client.timelineItem.findMany({ where: character }))
  ]

  return rows
    .map(({ code, occurredAt, name }) => `${code}|${occurredAt.toISOString()}|${name}`)
    .toSorted()
}

test('옛 시즌 받기가 저장한 구간에 강화 백필을 두 번 돌려도 이름 변경과 강화 행이 한 번씩만 남고 다른 코드 행은 그대로다', {
  skip: port === undefined
}, async (t) => {
  const client = await migratedDatabase(t, 'timeline_backfill_after_season')
  const raid = event(201, at('2020-02-02T00:00:00'), '레이드')
  const acquisition = item(505, at('2020-02-04T00:00:00'), '아이템 획득')
  await replaceSeasonBackfillRange(
    client,
    character,
    7,
    seasonRange,
    [nameChange, adventureNameChange, raid],
    [amplify, acquisition]
  )
  const expected = await storedRows(client)
  assert.equal(expected.length, 5)

  for (let run = 0; run < 2; run++) {
    await replaceEnhancementBackfillRange(
      client,
      character,
      backfillRange,
      backfillCodes,
      [nameChange, adventureNameChange],
      [amplify]
    )
    assert.deepEqual(await storedRows(client), expected)
  }

  assert.deepEqual(await readEnhancementBackfilledUntil(client, character), backfillRange.end)
})

test('강화 백필 뒤 옛 시즌 받기가 같은 구간을 받아도 이름 변경 행이 두 번 생기지 않는다', {
  skip: port === undefined
}, async (t) => {
  const client = await migratedDatabase(t, 'timeline_season_after_backfill')
  await replaceEnhancementBackfillRange(
    client,
    character,
    backfillRange,
    backfillCodes,
    [nameChange],
    [amplify]
  )
  await replaceSeasonBackfillRange(client, character, 7, seasonRange, [nameChange], [amplify])

  assert.deepEqual(await storedRows(client), [
    `102|${nameChange.occurredAt.toISOString()}|캐릭터명 변경`,
    `402|${amplify.occurredAt.toISOString()}|아이템 증폭`
  ])
})

test('강화 백필은 백필 코드가 아닌 행을 받으면 저장하지 않고 거절한다', {
  skip: port === undefined
}, async (t) => {
  const client = await migratedDatabase(t, 'timeline_backfill_reject')
  const raid = event(201, at('2020-02-02T00:00:00'), '레이드')

  await assert.rejects(
    replaceEnhancementBackfillRange(client, character, backfillRange, backfillCodes, [raid], []),
    RangeError
  )
  assert.deepEqual(await storedRows(client), [])
  assert.equal(await readEnhancementBackfilledUntil(client, character), null)
})

test('백필 위치를 비우는 migration은 강화 백필 위치만 비우고 정기 동기화 위치와 타임라인 행은 그대로 둔다', {
  skip: port === undefined
}, async (t) => {
  const database = 'timeline_backfill_restart'
  await recreateDatabase(database)
  const client = connect(database)
  t.after(() => client.$disconnect())
  await runMigrationsBefore(client, restartMigration)

  const syncedUntil = at('2026-11-01T00:00:00')
  const finished = { serverId: 'cain', characterId: 'backfill-finished' }
  const partial = { serverId: 'cain', characterId: 'backfill-partial' }
  const neverBackfilled = { serverId: 'cain', characterId: 'backfill-never' }
  await client.timelineSyncState.createMany({
    data: [
      { ...finished, syncedUntil, enhancementBackfilledUntil: at('2025-01-09T05:59:00') },
      { ...partial, syncedUntil, enhancementBackfilledUntil: at('2020-02-29T00:00:00') },
      { ...neverBackfilled, syncedUntil }
    ]
  })
  await client.timelineItem.create({ data: { ...finished, ...amplify } })

  await runMigration(client, restartMigration)

  for (const target of [finished, partial, neverBackfilled]) {
    assert.equal(await readEnhancementBackfilledUntil(client, target), null)
  }
  assert.deepEqual(
    (await client.timelineSyncState.findMany({ select: { syncedUntil: true } })).map(
      (state) => state.syncedUntil
    ),
    [syncedUntil, syncedUntil, syncedUntil]
  )
  assert.equal(await client.timelineItem.count({ where: finished }), 1)
})
