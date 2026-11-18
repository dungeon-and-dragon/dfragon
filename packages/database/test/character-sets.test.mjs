import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import {
  applyMigrations,
  createDatabaseClient,
  recordCharacter,
  recordCharacterSets
} from '../dist/index.js'

const port = process.env.DFRAGON_TEST_CHARACTER_SETS_PORT
const database = 'character_sets'

const connect = (name) =>
  createDatabaseClient({
    host: '127.0.0.1',
    port: Number(port),
    database: name,
    username: 'sets_test',
    password: 'synthetic'
  })

let client

before(async () => {
  if (port === undefined) {
    return
  }

  const admin = connect('sets_test')

  try {
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${database}"`)
    await admin.$executeRawUnsafe(`CREATE DATABASE "${database}"`)
  } finally {
    await admin.$disconnect()
  }

  const environment = { ...process.env }
  Object.assign(process.env, {
    DB_HOST: '127.0.0.1',
    DB_PORT: port,
    DB_NAME: database,
    DB_USERNAME: 'sets_test',
    DB_PASSWORD: 'synthetic'
  })

  try {
    await applyMigrations()
  } finally {
    process.env = environment
  }

  client = connect(database)
})

after(() => client?.$disconnect())

const at = (time) => new Date(`2026-11-${time}+09:00`)
const fairy = { id: 'set-fairy', name: '소울 페어리 세트' }
const golden = { id: 'set-golden', name: '영원히 이어지는 황금향 세트' }
const dragon = { id: 16204, name: '야망의 용투 서약', option: '용투 : 세계를 태우는 불꽃' }

async function createCharacter(characterId) {
  const key = { serverId: 'cain', characterId }

  await recordCharacter(client, {
    ...key,
    characterName: `합성${characterId}`,
    adventureName: '합성모험단'
  })

  return key
}

async function readSets({ serverId, characterId }) {
  const [row] = await client.$queryRaw`
    SELECT "equipment_set_id", "equipment_set_name", "oath_set_id", "oath_set_name",
      "oath_set_option", "sets_fetched_at", xmin::text AS "version"
    FROM "characters"
    WHERE "server_id" = ${serverId} AND "character_id" = ${characterId}`

  return row
}

test('세트 값과 받은 시각을 저장하고 세트가 없으면 null로 두되 받은 시각은 채운다', {
  skip: port === undefined
}, async () => {
  const withSets = await createCharacter('sets-a')
  const withoutSets = await createCharacter('sets-b')

  await recordCharacterSets(client, {
    ...withSets,
    equipmentSet: fairy,
    oathSet: dragon,
    fetchedAt: at('18T10:00:00')
  })
  await recordCharacterSets(client, {
    ...withoutSets,
    equipmentSet: null,
    oathSet: null,
    fetchedAt: at('18T10:00:00')
  })

  const { version: _a, ...stored } = await readSets(withSets)
  const { version: _b, ...empty } = await readSets(withoutSets)

  assert.deepEqual(stored, {
    equipment_set_id: 'set-fairy',
    equipment_set_name: '소울 페어리 세트',
    oath_set_id: 16204,
    oath_set_name: '야망의 용투 서약',
    oath_set_option: '용투 : 세계를 태우는 불꽃',
    sets_fetched_at: at('18T10:00:00')
  })
  assert.deepEqual(empty, {
    equipment_set_id: null,
    equipment_set_name: null,
    oath_set_id: null,
    oath_set_name: null,
    oath_set_option: null,
    sets_fetched_at: at('18T10:00:00')
  })
})

test('같은 세트 값을 늦은 시각으로 다시 저장해도 행을 쓰지 않는다', {
  skip: port === undefined
}, async () => {
  const key = await createCharacter('sets-same')
  const sets = { equipmentSet: fairy, oathSet: dragon }

  await recordCharacterSets(client, { ...key, ...sets, fetchedAt: at('18T10:00:00') })
  const first = await readSets(key)
  await recordCharacterSets(client, { ...key, ...sets, fetchedAt: at('18T11:00:00') })
  const second = await readSets(key)

  assert.equal(second.version, first.version)
  assert.deepEqual(second.sets_fetched_at, at('18T10:00:00'))
})

test('저장된 받은 시각보다 이른 값은 덮지 않고 늦은 값은 덮는다', {
  skip: port === undefined
}, async () => {
  const key = await createCharacter('sets-order')

  await recordCharacterSets(client, {
    ...key,
    equipmentSet: golden,
    oathSet: null,
    fetchedAt: at('18T12:00:00')
  })
  await recordCharacterSets(client, {
    ...key,
    equipmentSet: fairy,
    oathSet: dragon,
    fetchedAt: at('18T11:00:00')
  })
  const kept = await readSets(key)

  assert.equal(kept.equipment_set_id, 'set-golden')
  assert.equal(kept.oath_set_id, null)
  assert.deepEqual(kept.sets_fetched_at, at('18T12:00:00'))

  await recordCharacterSets(client, {
    ...key,
    equipmentSet: fairy,
    oathSet: dragon,
    fetchedAt: at('18T13:00:00')
  })
  const replaced = await readSets(key)

  assert.equal(replaced.equipment_set_id, 'set-fairy')
  assert.equal(replaced.oath_set_option, '용투 : 세계를 태우는 불꽃')
  assert.deepEqual(replaced.sets_fetched_at, at('18T13:00:00'))
})

test('서약 선택지만 바뀌어도 새 값으로 덮는다', { skip: port === undefined }, async () => {
  const key = await createCharacter('sets-option')

  await recordCharacterSets(client, {
    ...key,
    equipmentSet: fairy,
    oathSet: dragon,
    fetchedAt: at('18T10:00:00')
  })
  await recordCharacterSets(client, {
    ...key,
    equipmentSet: fairy,
    oathSet: { ...dragon, option: '용투 : 합성 선택지' },
    fetchedAt: at('18T11:00:00')
  })
  const stored = await readSets(key)

  assert.equal(stored.oath_set_option, '용투 : 합성 선택지')
  assert.deepEqual(stored.sets_fetched_at, at('18T11:00:00'))
})
