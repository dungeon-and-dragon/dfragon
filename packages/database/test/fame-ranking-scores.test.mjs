import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import {
  applyMigrations,
  countFameRanking,
  createDatabaseClient,
  readFameRanking,
  recordCharacterBasic,
  recordCharacterScore,
  recordCharacterSets
} from '../dist/index.js'

const port = process.env.DFRAGON_TEST_FAME_SCORES_PORT
const database = 'fame_scores'

const connect = (name) =>
  createDatabaseClient({
    host: '127.0.0.1',
    port: Number(port),
    database: name,
    username: 'score_sort_test',
    password: 'synthetic'
  })

let client

before(async () => {
  if (port === undefined) {
    return
  }

  const admin = connect('score_sort_test')

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
    DB_USERNAME: 'score_sort_test',
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
const job = { jobId: 'synthetic-score-job', jobGrowId: 'synthetic-score-grow' }
const fairy = { id: 'set-score-fairy', name: '합성 세트' }
const engine = { package: 'dnfscore-native 0.4.2', rulesRev: 'rev14', bundleId: 'phase32-rev14d' }

async function createCharacter(
  serverId,
  characterId,
  { fame = 100000, score, kind = 'equipment', scoredJob = job, set } = {}
) {
  const key = { serverId, characterId }

  await recordCharacterBasic(client, {
    ...key,
    ...job,
    characterName: `합성${characterId}`,
    adventureName: '합성점수모험단',
    level: 115,
    jobName: '합성직업',
    jobGrowName: '합성전직',
    fame,
    guildId: null,
    guildName: null
  })

  if (set !== undefined) {
    await recordCharacterSets(client, {
      ...key,
      equipmentSet: set,
      oathSet: null,
      items: [],
      fetchedAt: new Date('2026-11-19T00:00:00Z')
    })
  }

  if (score !== undefined) {
    await recordCharacterScore(client, {
      ...key,
      job: scoredJob,
      kind,
      score,
      calculatedAt: new Date('2026-11-19T00:00:00Z'),
      engine
    })
  }
}

const ids = (rows) => rows.map(({ serverId, characterId }) => `${serverId}/${characterId}`)

test('점수 기준은 그 종류의 점수가 저장된 캐릭터만 점수 내림차순, 서버, 캐릭터 순으로 주고 범위, 세트, 전직 조건을 함께 건다', {
  skip: port === undefined
}, async () => {
  await createCharacter('siroco', 'tie-b', { score: 2000, set: fairy })
  await createCharacter('cain', 'tie-a', { score: 2000 })
  await createCharacter('cain', 'top', { fame: 1000, score: 3000, set: fairy })
  await createCharacter('cain', 'low', { fame: 200000, score: 1000, set: fairy })
  await createCharacter('cain', 'buffer', { score: 9000, kind: 'buff' })
  await createCharacter('cain', 'unscored', { fame: 300000 })
  await createCharacter('cain', 'old-grow', {
    score: 5000,
    scoredJob: { ...job, jobGrowId: 'synthetic-old-grow' }
  })
  await createCharacter('cain', 'unknown-job', { score: 4000, scoredJob: null })

  const read = (filter) => readFameRanking(client, { ...job, ...filter }, 100)

  assert.deepEqual(ids(await read({ sort: 'equipmentScore' })), [
    'cain/top',
    'cain/tie-a',
    'siroco/tie-b',
    'cain/low'
  ])
  assert.deepEqual(ids(await read({ sort: 'buffScore' })), ['cain/buffer'])
  assert.deepEqual(ids(await read({ sort: 'equipmentScore', scoreFrom: 1500, scoreTo: 2500 })), [
    'cain/tie-a',
    'siroco/tie-b'
  ])
  assert.deepEqual(ids(await read({ sort: 'equipmentScore', equipmentSetId: fairy.id })), [
    'cain/top',
    'siroco/tie-b',
    'cain/low'
  ])
  assert.deepEqual(
    ids(await readFameRanking(client, { sort: 'equipmentScore' }, 100)).filter((id) =>
      ['cain/old-grow', 'cain/unknown-job'].includes(id)
    ),
    ['cain/old-grow', 'cain/unknown-job']
  )
  assert.deepEqual(ids(await read({})), [
    'cain/unscored',
    'cain/low',
    'cain/buffer',
    'cain/old-grow',
    'cain/tie-a',
    'cain/unknown-job',
    'siroco/tie-b',
    'cain/top'
  ])
})

test('점수 기준으로 page를 나눠 읽어도 같은 점수의 page 경계에서 빠지거나 겹치는 캐릭터가 없다', {
  skip: port === undefined
}, async () => {
  const pagedJob = { jobId: 'synthetic-paged-job', jobGrowId: 'synthetic-paged-grow' }

  for (let index = 0; index < 9; index++) {
    const serverId = index % 2 === 0 ? 'cain' : 'siroco'
    const characterId = `paged-${index}`

    await recordCharacterBasic(client, {
      serverId,
      characterId,
      ...pagedJob,
      characterName: `합성${characterId}`,
      adventureName: '합성점수모험단',
      level: 115,
      jobName: '합성직업',
      jobGrowName: '합성전직',
      fame: 100000,
      guildId: null,
      guildName: null
    })
    await recordCharacterScore(client, {
      serverId,
      characterId,
      job: pagedJob,
      kind: 'equipment',
      score: 5000 - Math.floor(index / 3),
      calculatedAt: new Date('2026-11-19T00:00:00Z'),
      engine
    })
  }

  const filter = { ...pagedJob, sort: 'equipmentScore' }
  const pages = []

  for (let offset = 0; pages.at(-1)?.length !== 0; offset += 2) {
    pages.push(await readFameRanking(client, filter, 2, offset))
  }

  assert.deepEqual(ids(pages.flat()), ids(await readFameRanking(client, filter, 100)))
  assert.equal(pages.flat().length, 9)
  assert.equal(await countFameRanking(client, filter), 9)
})
