import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import test from 'node:test'
import { applyMigrations, createDatabaseClient, recordClearRecords } from '../dist/index.js'

const port = process.env.DFRAGON_TEST_CLEAR_RECORD_PORT
const newMigration = '20261114120000_add_clear_records'
const migrationsDirectory = new URL('../prisma/migrations/', import.meta.url)

const connect = (database) => {
  const portNumber = Number(port)

  return createDatabaseClient({
    host: '127.0.0.1',
    port: portNumber,
    database,
    username: 'clear_record_test',
    password: 'synthetic'
  })
}

async function recreateDatabase(database) {
  const admin = connect('clear_record_test')

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

const at = (time) => new Date(`${time}+09:00`)
const thisWeek = at('2026-11-05T06:00:00')
const raid = (name, modeName, time, extra = {}) => {
  const clearedAt = at(time)

  return {
    kind: 'raid',
    serverId: 'cain',
    characterId: 'record-a',
    name,
    modeName,
    hard: false,
    partyName: '합성 공격대',
    clearedAt,
    weekStart: thisWeek,
    ...extra
  }
}

const legion = (name, time) => {
  const clearedAt = at(time)

  return {
    kind: 'legion',
    serverId: 'cain',
    characterId: 'record-a',
    name,
    clearedAt,
    weekStart: thisWeek
  }
}

// 합성 기록이다. 단계 이름은 운영 DB에서 본 레이드 단계(싱글/매칭, 매칭, 개전, 일반, 하드)를 하나씩 담는다.
const records = [
  raid('무너진 성자 미카엘라', '미카엘라 : 균열서', '2026-11-06T20:00:00', { partyName: null }),
  raid('디레지에 레이드', '디레지에 : 서막', '2026-11-06T21:00:00'),
  raid('기계 혁명', '개전', '2026-11-06T22:00:00'),
  raid('무너진 성자 미카엘라', '미카엘라 : 종언서', '2026-11-07T20:00:00'),
  raid('무너진 성자 미카엘라', '미카엘라 : 종언서(하드)', '2026-11-07T21:15:00', { hard: true }),
  raid('이내 황혼전', null, '2026-11-08T20:00:00'),
  raid('무너진 성자 미카엘라', '미카엘라 : 종언서', '2026-11-07T20:00:00', {
    characterId: 'record-b'
  }),
  legion('베누스', '2026-11-06T19:00:00'),
  legion('합성 레기온', '2026-11-06T19:30:00')
]

const expectedRows = [
  'raid|cain|record-a|무너진 성자 미카엘라|미카엘라 : 균열서|false|-|11-06 20:00|11-05',
  'raid|cain|record-a|디레지에 레이드|디레지에 : 서막|false|합성 공격대|11-06 21:00|11-05',
  'raid|cain|record-a|기계 혁명|개전|false|합성 공격대|11-06 22:00|11-05',
  'raid|cain|record-a|무너진 성자 미카엘라|미카엘라 : 종언서|false|합성 공격대|11-07 20:00|11-05',
  'raid|cain|record-a|무너진 성자 미카엘라|미카엘라 : 종언서(하드)|true|합성 공격대|11-07 21:15|11-05',
  'raid|cain|record-a|이내 황혼전|-|false|합성 공격대|11-08 20:00|11-05',
  'raid|cain|record-b|무너진 성자 미카엘라|미카엘라 : 종언서|false|합성 공격대|11-07 20:00|11-05',
  'legion|cain|record-a|베누스|-|-|-|11-06 19:00|11-05',
  'legion|cain|record-a|합성 레기온|-|-|-|11-06 19:30|11-05'
].toSorted()

const storedRows = async (client) =>
  (
    await client.$queryRaw`
      SELECT concat_ws('|', kind, server_id, character_id, name, coalesce(mode_name, '-'),
        coalesce(hard::text, '-'), coalesce(party_name, '-'),
        to_char(cleared_at AT TIME ZONE 'Asia/Seoul', 'MM-DD HH24:MI'),
        to_char(week_start AT TIME ZONE 'Asia/Seoul', 'MM-DD')) AS row
      FROM clear_records`
  )
    .map(({ row }) => row)
    .toSorted()

test('빈 DB에 시작 migration을 적용하면 레이드 모든 단계와 레기온 기록을 한 번씩만 저장한다', {
  skip: port === undefined
}, async (t) => {
  const database = 'clear_record_empty'
  const environment = { ...process.env }

  await recreateDatabase(database)
  t.after(() => {
    process.env = environment
  })
  Object.assign(process.env, {
    DB_HOST: '127.0.0.1',
    DB_PORT: port,
    DB_NAME: database,
    DB_USERNAME: 'clear_record_test',
    DB_PASSWORD: 'synthetic'
  })
  await applyMigrations()

  const client = connect(database)
  t.after(() => client.$disconnect())

  await recordClearRecords(client, records)
  assert.deepEqual(await storedRows(client), expectedRows)

  await recordClearRecords(client, records)
  await recordClearRecords(client, [...records, ...records.toReversed()])

  for (const record of records) {
    await recordClearRecords(client, [record])
  }

  assert.deepEqual(await storedRows(client), expectedRows)

  await recordClearRecords(client, [])
  assert.deepEqual(await storedRows(client), expectedRows)
})

test('레기온 행은 단계, 하드 여부, 공격대 이름을 가질 수 없고 레이드 행은 하드 여부가 있어야 한다', {
  skip: port === undefined
}, async (t) => {
  const database = 'clear_record_check'

  await recreateDatabase(database)

  const client = connect(database)
  t.after(() => client.$disconnect())
  await runMigration(client, newMigration)

  const insert = (kind, modeName, hard, partyName) =>
    client.$executeRaw`
      INSERT INTO clear_records
        (server_id, character_id, kind, name, mode_name, hard, party_name, cleared_at, week_start)
      VALUES ('cain', 'record-check', ${kind}, '합성', ${modeName}, ${hard}, ${partyName},
        now(), now())`

  const checkViolation = /clear_records_kind_check/

  await assert.rejects(insert('legion', '단계', null, null), checkViolation)
  await assert.rejects(insert('legion', null, false, null), checkViolation)
  await assert.rejects(insert('legion', null, null, '합성 공격대'), checkViolation)
  await assert.rejects(insert('raid', '단계', null, '합성 공격대'), checkViolation)
  await assert.rejects(insert('challenge', null, false, null), checkViolation)
  assert.equal(await insert('raid', null, true, null), 1)
  assert.equal(await insert('legion', null, null, null), 1)
})

test('기존 테이블과 행이 있는 DB에 migration을 적용해도 기존 행은 그대로이고 새 테이블에 저장된다', {
  skip: port === undefined
}, async (t) => {
  const database = 'clear_record_existing'

  await recreateDatabase(database)

  const client = connect(database)
  t.after(() => client.$disconnect())

  const previousMigrations = (await readdir(migrationsDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name < newMigration)
    .map(({ name }) => name)
    .toSorted()

  for (const name of previousMigrations) {
    await runMigration(client, name)
  }

  await client.$executeRaw`
    INSERT INTO adventures (name) VALUES ('합성기록모험단')`
  await client.$executeRaw`
    INSERT INTO characters (server_id, character_id, character_name, adventure_id, max_fame)
    SELECT 'cain', 'record-a', '합성기록', id, 120000 FROM adventures`
  await client.$executeRaw`
    INSERT INTO content_clears
      (content_id, kind, server_id, character_id, week_start, cleared_at, ratio)
    VALUES ('michaela-hard', 'raid', 'cain', 'record-a', ${thisWeek},
      ${at('2026-11-07T21:15:00')}, 50)`

  const existingRows = async () => {
    const characters = await client.$queryRaw`
      SELECT server_id, character_id, character_name, max_fame FROM characters`
    const contentClears = await client.$queryRaw`SELECT * FROM content_clears`

    return { characters, contentClears }
  }

  const before = await existingRows()

  await runMigration(client, newMigration)
  assert.deepEqual(await existingRows(), before)
  assert.deepEqual(await storedRows(client), [])

  await recordClearRecords(client, records)
  assert.deepEqual(await storedRows(client), expectedRows)
})
