import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import {
  applyMigrations,
  createDatabaseClient,
  readItemAdoption,
  recordCharacterBasic,
  recordCharacterSets,
  replaceItemAdoption,
  replaceLabCandidateWearCounts
} from '../dist/index.js'

const port = process.env.DFRAGON_TEST_LAB_WEAR_COUNT_PORT
const database = 'lab_wear_count'

const connect = (name) =>
  createDatabaseClient({
    host: '127.0.0.1',
    port: Number(port),
    database: name,
    username: 'wear_count_test',
    password: 'synthetic'
  })

let client

before(async () => {
  if (port === undefined) {
    return
  }

  const admin = connect('wear_count_test')

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
    DB_USERNAME: 'wear_count_test',
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

// 합성 전직과 남성 크루세이더 id다. 이 검사의 캐릭터는 모두 합성 전직이라 크루세이더 역할 판정은 쓰이지 않는다.
const job = { jobId: 'synthetic-wear-job', jobGrowId: 'synthetic-wear-grow' }
const maleCrusader = { jobId: 'synthetic-crusader-job', jobGrowId: 'synthetic-crusader-grow' }
const fetchedAt = new Date('2026-11-28T00:00:00Z')
const item = (slotId, itemName, typeDetail = null) => ({
  slotId,
  itemId: `${slotId}-${itemName}`,
  itemName,
  typeDetail
})

async function recordWearer(characterId, items, fame = 90000) {
  await recordCharacterBasic(client, {
    serverId: 'cain',
    characterId,
    characterName: `합성${characterId}`,
    adventureName: '합성착용모험단',
    level: 115,
    ...job,
    jobName: '합성직업',
    jobGrowName: '합성전직',
    fame,
    guildId: null,
    guildName: null
  })
  await recordCharacterSets(client, {
    serverId: 'cain',
    characterId,
    equipmentSet: null,
    oathSet: null,
    items,
    fetchedAt
  })
}

async function readWearCounts() {
  return client.$queryRaw`
    SELECT "item_name" AS "itemName", "slot_id" AS "slotId", "count", "computed_at" AS "computedAt"
    FROM "lab_candidate_wear_counts"
    ORDER BY "slot_id", "item_name"`
}

test('착용 수 교체는 칭호, 오라, 크리쳐만 이름과 부위별로 세고, 다시 돌리면 지금 착용만 남긴다', {
  skip: port === undefined
}, async () => {
  const weapon = item('WEAPON', '합성 착용 무기', '도')
  const support = item('SUPPORT', '합성 착용 보조장비')

  await recordWearer('wear-a', [
    weapon,
    support,
    item('TITLE', '합성 칭호[45Lv]', '칭호'),
    item('AURORA', '합성 오라'),
    item('CREATURE', '합성 크리쳐')
  ])
  await recordWearer('wear-b', [weapon, item('TITLE', '합성 칭호[45Lv]', '칭호')])
  await recordWearer('wear-c', [
    item('TITLE', '합성 칭호', '칭호'),
    item('CREATURE', '합성 크리쳐')
  ])

  const first = new Date('2026-11-28T00:30:00Z')
  assert.equal(await replaceLabCandidateWearCounts(client, first), 4)
  assert.deepEqual(await readWearCounts(), [
    { itemName: '합성 오라', slotId: 'AURORA', count: 1, computedAt: first },
    { itemName: '합성 크리쳐', slotId: 'CREATURE', count: 2, computedAt: first },
    { itemName: '합성 칭호', slotId: 'TITLE', count: 1, computedAt: first },
    { itemName: '합성 칭호[45Lv]', slotId: 'TITLE', count: 2, computedAt: first }
  ])

  await recordWearer('wear-a', [weapon, support, item('TITLE', '합성 칭호', '칭호')])
  const second = new Date('2026-11-29T00:30:00Z')
  assert.equal(await replaceLabCandidateWearCounts(client, second), 3)
  assert.deepEqual(await readWearCounts(), [
    { itemName: '합성 크리쳐', slotId: 'CREATURE', count: 1, computedAt: second },
    { itemName: '합성 칭호', slotId: 'TITLE', count: 2, computedAt: second },
    { itemName: '합성 칭호[45Lv]', slotId: 'TITLE', count: 1, computedAt: second }
  ])
})

test('유일 장비 집계는 칭호, 오라, 크리쳐 줄이 더해져도 결과가 같다', {
  skip: port === undefined
}, async () => {
  const weapon = item('WEAPON', '합성 집계 무기', '도')
  const ring = item('RING', '합성 집계 반지')

  await recordWearer('adoption-a', [weapon, ring], 80000)
  await recordWearer('adoption-b', [weapon], 79000)
  const query = { sample: 'all', ...job }

  await replaceItemAdoption(client, { computedAt: fetchedAt, maleCrusader })
  const { computedAt: _before, ...withoutWorn } = await readItemAdoption(client, query)

  await recordWearer(
    'adoption-a',
    [
      weapon,
      ring,
      item('TITLE', '합성 집계 칭호', '칭호'),
      item('AURORA', '합성 집계 오라'),
      item('CREATURE', '합성 집계 크리쳐')
    ],
    80000
  )
  await recordWearer('adoption-b', [weapon, item('TITLE', '합성 집계 칭호', '칭호')], 79000)
  await replaceItemAdoption(client, { computedAt: fetchedAt, maleCrusader })
  const { computedAt: _after, ...withWorn } = await readItemAdoption(client, query)

  assert.deepEqual(withWorn, withoutWorn)
  assert.ok(withWorn.slots.some(({ slotId }) => slotId === 'RING'))
  assert.ok(withWorn.slots.every(({ slotId }) => !['TITLE', 'AURORA', 'CREATURE'].includes(slotId)))
})
