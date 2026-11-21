import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import {
  applyMigrations,
  countClearPopulation,
  countFameRefreshTargets,
  countInactiveCharacters,
  createDatabaseClient,
  readClearPopulation,
  readClearPopulationPage,
  readFameRefreshTargets,
  readInactiveCharacters,
  readSampleCharactersWithoutSkillStyle,
  recordCharacter,
  recordCharacterActive,
  recordCharacterBasic,
  recordCharacterInactive,
  recordCharactersActive
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

test('마지막 활동은 더 최근 시각일 때만 바꾸고, 활동을 기록한 비활성 캐릭터는 활성으로 돌림', {
  skip: port === undefined
}, async () => {
  const lastActiveOf = async (characterId) =>
    (await readFameRefreshTargets(client, null, 100)).find(
      (target) => target.serverId === 'anton' && target.characterId === characterId
    )?.lastActiveAt

  const active = await createFetched('anton', 'active')
  const inactive = await createFetched('anton', 'inactive')
  const unseen = await createFetched('anton', 'unseen')

  await recordCharacterActive(client, active, at('18T21:00:00'))
  await recordCharacterInactive(client, inactive, at('19T03:00:00'))

  await recordCharactersActive(client, [
    { ...active, lastActiveAt: at('10T21:00:00') },
    { ...inactive, lastActiveAt: at('19T22:00:00') },
    { ...unseen, lastActiveAt: at('12T21:00:00') }
  ])

  assert.deepEqual(await lastActiveOf('active'), at('18T21:00:00'))
  assert.deepEqual(await lastActiveOf('inactive'), at('19T22:00:00'))
  assert.deepEqual(await lastActiveOf('unseen'), at('12T21:00:00'))

  await recordCharactersActive(client, [{ ...active, lastActiveAt: at('20T21:00:00') }])

  assert.deepEqual(await lastActiveOf('active'), at('20T21:00:00'))
})

test('클리어 모집단은 활성만 읽으면 비활성 캐릭터를 빼고, 비활성까지 읽으면 함께 읽음', {
  skip: port === undefined
}, async () => {
  const bakalOf = (rows) => keysOf(rows).filter((key) => key.startsWith('bakal/'))

  await createFetched('bakal', 'active')
  const inactive = await createFetched('bakal', 'inactive')
  await recordCharacterInactive(client, inactive, at('19T03:00:00'))

  const activeOnly = await readClearPopulation(client, 50000, 'active-only')
  assert.deepEqual(bakalOf(activeOnly), ['bakal/active'])

  const includingInactive = await readClearPopulation(client, 50000, 'include-inactive')
  assert.deepEqual(bakalOf(includingInactive), ['bakal/active', 'bakal/inactive'])

  const everyone = { after: undefined, skip: 0, limit: 1000 }
  const activePage = await readClearPopulationPage(
    client,
    { minMaxFame: 50000, activity: 'active-only' },
    everyone
  )

  assert.deepEqual(bakalOf(activePage), ['bakal/active'])
  assert.equal(
    await countClearPopulation(client, { minMaxFame: 50000, activity: 'active-only' }),
    activePage.length
  )

  const includingInactivePage = await readClearPopulationPage(
    client,
    { minMaxFame: 50000, activity: 'include-inactive' },
    everyone
  )

  assert.deepEqual(bakalOf(includingInactivePage), ['bakal/active', 'bakal/inactive'])
  assert.equal(
    await countClearPopulation(client, { minMaxFame: 50000, activity: 'include-inactive' }),
    includingInactivePage.length
  )
})

test('스킬 스타일 수집 대상에서 비활성 캐릭터를 뺌', {
  skip: port === undefined
}, async () => {
  await createFetched('hilder', 'active')
  const inactive = await createFetched('hilder', 'inactive')
  await recordCharacterInactive(client, inactive, at('19T03:00:00'))

  const targets = await readSampleCharactersWithoutSkillStyle(client)

  assert.deepEqual(
    keysOf(targets).filter((key) => key.startsWith('hilder/')),
    ['hilder/active']
  )
})
