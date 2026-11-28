import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import {
  applyMigrations,
  countFameRanking,
  createDatabaseClient,
  readFameRanking,
  recordCharacterBasic,
  recordCharacterSkillStyle
} from '../dist/index.js'

const port = process.env.DFRAGON_TEST_FAME_EVOLUTIONS_PORT
const database = 'fame_evolutions'

const connect = (name) =>
  createDatabaseClient({
    host: '127.0.0.1',
    port: Number(port),
    database: name,
    username: 'evolution_test',
    password: 'synthetic'
  })

let client

before(async () => {
  if (port === undefined) {
    return
  }

  const admin = connect('evolution_test')

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
    DB_USERNAME: 'evolution_test',
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

// 합성 캐릭터와 스킬이다.
const job = { jobId: 'synthetic-evolution-job', jobGrowId: 'synthetic-evolution-grow' }
const slash = '합성 베기'
const thrust = '합성 찌르기 (각성)'

async function createCharacter(characterId, fame, evolutions, styleJob = job) {
  const key = { serverId: 'cain', characterId }

  await recordCharacterBasic(client, {
    ...key,
    ...job,
    characterName: `합성${characterId}`,
    adventureName: '합성개화모험단',
    level: 115,
    jobName: '합성직업',
    jobGrowName: '합성전직',
    fame,
    guildId: null,
    guildName: null
  })

  if (evolutions !== undefined) {
    await recordCharacterSkillStyle(client, {
      ...key,
      ...styleJob,
      skills: [],
      evolutions,
      enhancements: [],
      fetchedAt: new Date('2026-11-19T00:00:00Z')
    })
  }
}

const ids = (rows) => rows.map(({ characterId }) => characterId)

test('개화 필터는 고른 쌍을 모두 가진 지금 전직의 스킬 스타일만 명성 내림차순으로 고르고 같은 스킬의 종류 1과 2를 구분한다', {
  skip: port === undefined
}, async () => {
  await createCharacter('both-1', 130000, [
    { name: slash, type: 1 },
    { name: thrust, type: 2 }
  ])
  await createCharacter('slash-2', 125000, [
    { name: slash, type: 2 },
    { name: thrust, type: 2 }
  ])
  await createCharacter('slash-only', 120000, [{ name: slash, type: 1 }])
  await createCharacter('no-style', 140000)
  await createCharacter('old-grow', 150000, [{ name: slash, type: 1 }], {
    ...job,
    jobGrowId: 'synthetic-old-grow'
  })

  const readIds = async (evolutions) =>
    ids(await readFameRanking(client, { ...job, evolutions }, 100))

  assert.deepEqual(await readIds([{ name: slash, type: 1 }]), ['both-1', 'slash-only'])
  assert.deepEqual(await readIds([{ name: slash, type: 2 }]), ['slash-2'])
  assert.deepEqual(
    await readIds([
      { name: slash, type: 1 },
      { name: thrust, type: 2 }
    ]),
    ['both-1']
  )
  assert.deepEqual(await readIds([{ name: '합성 없는 스킬', type: 1 }]), [])
  const unfiltered = await readFameRanking(client, job, 100)
  assert.deepEqual(ids(unfiltered), ['old-grow', 'no-style', 'both-1', 'slash-2', 'slash-only'])
})

test('개화 필터로 page를 나눠 읽어도 빠지거나 겹치는 캐릭터가 없다', {
  skip: port === undefined
}, async () => {
  const pagedJob = { jobId: 'synthetic-paged-job', jobGrowId: 'synthetic-paged-grow' }
  const expected = []

  // 같은 명성 넷 가운데 서버가 다른 둘이 개화를 골라, 세 명씩 읽으면 page 경계가 같은 명성의 두 서버 사이에 걸린다.
  for (let index = 0; index < 12; index++) {
    const characterId = `paged-${String(index).padStart(2, '0')}`
    const selected = index % 2 === 0
    const key = { serverId: index % 4 < 2 ? 'cain' : 'siroco', characterId }

    await recordCharacterBasic(client, {
      ...key,
      ...pagedJob,
      characterName: `합성${characterId}`,
      adventureName: '합성개화모험단',
      level: 115,
      jobName: '합성직업',
      jobGrowName: '합성전직',
      fame: 100000 - Math.floor(index / 4),
      guildId: null,
      guildName: null
    })
    await recordCharacterSkillStyle(client, {
      ...key,
      ...pagedJob,
      skills: [],
      evolutions: [{ name: slash, type: selected ? 1 : 2 }],
      enhancements: [],
      fetchedAt: new Date('2026-11-19T00:00:00Z')
    })

    if (selected) {
      expected.push(key)
    }
  }

  const filter = { ...pagedJob, evolutions: [{ name: slash, type: 1 }] }
  const pages = []

  for (let offset = 0; pages.at(-1)?.length !== 0; offset += 3) {
    pages.push(await readFameRanking(client, filter, 3, offset))
  }

  const read = pages.flat()
  const all = await readFameRanking(client, filter, 100)

  assert.deepEqual(
    read.map(({ serverId, characterId }) => `${serverId}/${characterId}`),
    all.map(({ serverId, characterId }) => `${serverId}/${characterId}`)
  )
  assert.deepEqual(
    read.map(({ serverId, characterId }) => `${serverId}/${characterId}`).toSorted(),
    expected.map(({ serverId, characterId }) => `${serverId}/${characterId}`).toSorted()
  )
  assert.equal(await countFameRanking(client, filter), expected.length)
})
