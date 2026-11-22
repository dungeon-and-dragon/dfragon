import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import {
  applyMigrations,
  createDatabaseClient,
  readAdventureCharacters,
  readCharacterScores,
  readFameRanking,
  readGuild,
  recordCharacterBasic,
  recordCharacterScore
} from '../dist/index.js'

const port = process.env.DFRAGON_TEST_STORED_SCORE_PORT
const database = 'stored_score'

const connect = (name) =>
  createDatabaseClient({
    host: '127.0.0.1',
    port: Number(port),
    database: name,
    username: 'score_test',
    password: 'synthetic'
  })

let client

before(async () => {
  if (port === undefined) {
    return
  }

  const admin = connect('score_test')

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
    DB_USERNAME: 'score_test',
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

// 합성 캐릭터다.
const jobId = 'synthetic-score-job'
const guildId = 'synthetic-score-guild'
const adventureName = '합성점수모험단'
const engine = { package: 'dnfscore-native 0.4.2', rulesRev: 'rev14', bundleId: 'phase32-rev14d' }

async function createCharacter(characterId, fame) {
  const key = { serverId: 'cain', characterId }

  await recordCharacterBasic(client, {
    ...key,
    characterName: `합성${characterId}`,
    adventureName,
    level: 115,
    jobId,
    jobGrowId: 'synthetic-grow',
    jobName: '합성직업',
    jobGrowName: '합성전직',
    fame,
    guildId,
    guildName: '합성길드'
  })

  return key
}

const approximate = {
  source: 'legacy_fusion_policy_a',
  warning: '근사값, 1% 밖일 가능성 높음: 판정 불가',
  skipped: { kind: 'resolution', message: '판정 불가' }
}

async function recordScore(key, kind, score, approximation = null) {
  await recordCharacterScore(client, {
    ...key,
    job: null,
    kind,
    score,
    calculatedAt: new Date('2026-11-19T00:00:00Z'),
    engine,
    approximate: approximation
  })
}

const scoresOf = (rows) => rows.map(({ characterId, score }) => [characterId, score])

test('캐릭터 목록 행에 저장된 점수를 종류, 근사 방식과 함께 붙이고 저장되지 않은 캐릭터는 null이며 명성 순서는 그대로다', {
  skip: port === undefined
}, async () => {
  const dealer = await createCharacter('dealer', 120000)
  const buffer = await createCharacter('buffer', 110000)
  await createCharacter('unscored', 115000)
  await recordScore(dealer, 'equipment', 1234567)
  await recordScore(buffer, 'buff', 4321000, approximate)

  const expected = [
    ['dealer', { kind: 'equipment', value: 1234567, approximateSource: null }],
    ['unscored', null],
    ['buffer', { kind: 'buff', value: 4321000, approximateSource: approximate.source }]
  ]

  assert.deepEqual(scoresOf(await readFameRanking(client, { jobId }, 100)), expected)
  assert.deepEqual(scoresOf((await readGuild(client, guildId)).members), expected)
  assert.deepEqual(scoresOf(await readAdventureCharacters(client, adventureName)), expected)
})

test('이름 검색 결과의 점수는 저장된 캐릭터만 읽고 목록에 없는 캐릭터와 다른 서버의 같은 ID는 읽지 않는다', {
  skip: port === undefined
}, async () => {
  const stored = await createCharacter('search-stored', 100000)
  const other = await createCharacter('search-other', 100000)
  await createCharacter('search-unscored', 100000)
  await recordScore(stored, 'equipment', 1111111, approximate)
  await recordScore(other, 'buff', 2222222)

  const rows = await readCharacterScores(client, [
    stored,
    { serverId: 'cain', characterId: 'search-unscored' },
    { serverId: 'siroco', characterId: 'search-other' },
    { serverId: 'cain', characterId: 'search-never-stored' }
  ])

  assert.deepEqual(rows, [
    {
      serverId: 'cain',
      characterId: 'search-stored',
      kind: 'equipment',
      value: 1111111,
      approximateSource: approximate.source
    }
  ])
  assert.deepEqual(await readCharacterScores(client, []), [])
})
