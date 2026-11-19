import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import {
  applyMigrations,
  countFameRefreshTargets,
  countInactiveCharacters,
  createDatabaseClient,
  readFameRefreshTargets,
  readInactiveCharacters,
  recordCharacter,
  recordCharacterActive,
  recordCharacterBasic,
  recordCharacterInactive
} from '../dist/index.js'

const port = process.env.DFRAGON_TEST_CHARACTER_ACTIVITY_PORT
const database = 'character_activity'

const connect = (name) =>
  createDatabaseClient({
    host: '127.0.0.1',
    port: Number(port),
    database: name,
    username: 'activity_test',
    password: 'synthetic'
  })

let client

before(async () => {
  if (port === undefined) {
    return
  }

  const admin = connect('activity_test')

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
    DB_USERNAME: 'activity_test',
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

// 합성 캐릭터다. 실제 Neople 응답이나 credential이 아니다.
async function createFetched(serverId, characterId) {
  await recordCharacterBasic(client, {
    serverId,
    characterId,
    characterName: `합성${characterId}`,
    adventureName: '합성모험단',
    level: 115,
    jobId: 'job-a',
    jobGrowId: 'grow-a1',
    jobName: '합성직업',
    jobGrowName: '합성전직',
    fame: 50000,
    guildId: null,
    guildName: null
  })

  return { serverId, characterId }
}

const keysOf = (rows) => rows.map(({ serverId, characterId }) => `${serverId}/${characterId}`)

test('명성 갱신 대상은 기본 정보를 받은 활성 캐릭터를 서버, 캐릭터 순으로 after 다음부터 나눠 읽음', {
  skip: port === undefined
}, async () => {
  await createFetched('siroco', 'b')
  await createFetched('cain', 'b')
  await createFetched('cain', 'a')
  const inactive = await createFetched('cain', 'c')
  await recordCharacter(client, {
    serverId: 'cain',
    characterId: 'unfetched',
    characterName: '합성미수집',
    adventureName: '합성모험단'
  })
  await recordCharacterInactive(client, inactive, at('19T03:00:00'))

  assert.equal(await countFameRefreshTargets(client), 3)
  assert.deepEqual(keysOf(await readFameRefreshTargets(client, null, 2)), ['cain/a', 'cain/b'])
  assert.deepEqual(
    keysOf(await readFameRefreshTargets(client, { serverId: 'cain', characterId: 'b' }, 2)),
    ['siroco/b']
  )
  assert.equal(await countInactiveCharacters(client), 1)
  assert.deepEqual(keysOf(await readInactiveCharacters(client, null, 10)), ['cain/c'])

  await recordCharacterActive(client, inactive, at('18T21:05:00'))

  assert.equal(await countInactiveCharacters(client), 0)
  const targets = await readFameRefreshTargets(client, null, 10)
  assert.deepEqual(keysOf(targets), ['cain/a', 'cain/b', 'cain/c', 'siroco/b'])
  assert.deepEqual(
    targets.find(({ characterId }) => characterId === 'c').lastActiveAt,
    at('18T21:05:00')
  )
})
