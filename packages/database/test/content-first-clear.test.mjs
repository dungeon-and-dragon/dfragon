import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import test from 'node:test'
import { createDatabaseClient } from '../dist/index.js'

const port = process.env.DFRAGON_TEST_CONTENT_FIRST_CLEAR_PORT
const newMigration = '20261128220000_add_content_first_clears'
const migrationsDirectory = new URL('../prisma/migrations/', import.meta.url)

const connect = (database) => {
  const portNumber = Number(port)

  return createDatabaseClient({
    host: '127.0.0.1',
    port: portNumber,
    database,
    username: 'first_clear_test',
    password: 'synthetic'
  })
}

async function recreateDatabase(database) {
  const admin = connect('first_clear_test')

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

async function runMigrationsBefore(client, until) {
  const names = (await readdir(migrationsDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name < until)
    .map(({ name }) => name)
    .toSorted()

  for (const name of names) {
    await runMigration(client, name)
  }
}

// 합성 타임라인 행이다. 실제 캐릭터, Neople 응답과 관계없다.
const at = (time) => new Date(`${time}+09:00`)
const event = (characterId, code, time, raidName, data = {}) => {
  const occurredAt = at(time)

  return {
    serverId: 'cain',
    characterId,
    code,
    occurredAt,
    name: '합성 기록',
    raidName,
    data
  }
}
const events = [
  event('first-a', 201, '2026-08-07T20:00:00', '무너진 성자 미카엘라'),
  event('first-b', 201, '2026-08-06T21:00:00', '무너진 성자 미카엘라'),
  event('first-a', 201, '2026-08-08T20:00:00', '무너진 성자 미카엘라'),
  event('first-a', 210, '2025-08-21T10:15:00', '이내 황혼전'),
  event('first-b', 201, '2025-09-13T06:16:00', '이내 황혼전'),
  event('first-a', 209, '2024-07-18T12:59:00', null, { regionName: '깨어난 숲(극)' }),
  event('first-b', 209, '2024-07-18T11:39:00', null, { regionName: '깨어난 숲(일반)' }),
  event('first-b', 209, '2024-07-19T11:39:00', null, { regionName: '깨어난 숲(일반)' }),
  event('first-a', 201, '2020-01-01T00:00:00', null),
  event('first-a', 209, '2020-01-01T00:00:00', null),
  event('first-a', 209, '2020-01-01T00:00:00', null, { regionName: '' }),
  event('first-a', 505, '2020-01-01T00:00:00', '합성 다른 기록', { regionName: '합성 다른 기록' })
]

const storedRows = async (client) =>
  (
    await client.$queryRaw`
      SELECT concat_ws('|', kind, name,
        to_char(first_cleared_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI')) AS row
      FROM content_first_clears`
  )
    .map(({ row }) => row)
    .toSorted()

test('migration이 레이드, 레기온 이름마다 클리어와 선발대 기록 가운데 가장 이른 시각 하나만 채우고 이름 없는 기록은 넣지 않는다', {
  skip: port === undefined
}, async (t) => {
  const database = 'content_first_clear_backfill'

  await recreateDatabase(database)

  const client = connect(database)
  t.after(() => client.$disconnect())
  await runMigrationsBefore(client, newMigration)
  await client.timelineEvent.createMany({ data: events })
  await runMigration(client, newMigration)

  assert.deepEqual(
    await storedRows(client),
    [
      'raid|무너진 성자 미카엘라|2026-08-06 21:00',
      'raid|이내 황혼전|2025-08-21 10:15',
      'legion|깨어난 숲(극)|2024-07-18 12:59',
      'legion|깨어난 숲(일반)|2024-07-18 11:39'
    ].toSorted()
  )
})

test('종류는 레이드와 레기온만 받고 같은 종류, 이름은 한 줄만 둔다', {
  skip: port === undefined
}, async (t) => {
  const database = 'content_first_clear_check'

  await recreateDatabase(database)

  const client = connect(database)
  t.after(() => client.$disconnect())
  await runMigrationsBefore(client, newMigration)
  await runMigration(client, newMigration)

  const insert = (kind, name) =>
    client.$executeRaw`
      INSERT INTO content_first_clears (kind, name, first_cleared_at)
      VALUES (${kind}, ${name}, now())`

  assert.equal(await insert('raid', '합성 레이드'), 1)
  assert.equal(await insert('legion', '합성 레이드'), 1)
  await assert.rejects(insert('raid', '합성 레이드'), /content_first_clears_pkey/)
  await assert.rejects(insert('challenge', '합성 도전'), /content_first_clears_kind_check/)
})
