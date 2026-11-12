import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  addBatchNeopleKey,
  createDatabaseClient,
  deleteBatchNeopleKey,
  readBatchNeopleKeys,
  readUsableBatchNeopleKeys,
  recordBatchNeopleKeyRejected,
  setBatchNeopleKeyEnabled
} from '../dist/index.js'

const port = process.env.DFRAGON_TEST_BATCH_NEOPLE_KEY_PORT

// 합성 key다. 실제 Neople key가 아니다.
const keys = {
  first: 'synthetic-batch-key-first-a1b2',
  second: 'synthetic-batch-key-second-c3d4',
  third: 'synthetic-batch-key-third-e5f6'
}

test('batch key 목록은 끝 4자만 돌려주고, worker용 읽기는 켜졌고 거절되지 않은 key만 돌려준다', {
  skip: port === undefined
}, async (t) => {
  const databasePort = Number(port)
  const client = createDatabaseClient({
    host: '127.0.0.1',
    port: databasePort,
    database: 'batch_key_test',
    username: 'batch_key_test',
    password: 'synthetic'
  })

  t.after(() => client.$disconnect())
  const migration = await readFile(
    new URL(
      '../prisma/migrations/20261112120000_add_batch_neople_keys/migration.sql',
      import.meta.url
    ),
    'utf8'
  )

  await client.$executeRawUnsafe('DROP TABLE IF EXISTS "batch_neople_keys"')

  for (const statement of migration
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)) {
    await client.$executeRawUnsafe(statement)
  }

  const first = await addBatchNeopleKey(client, { label: '첫째', key: keys.first })
  const second = await addBatchNeopleKey(client, { label: '둘째', key: keys.second })
  const third = await addBatchNeopleKey(client, { label: '셋째', key: keys.third })
  assert.equal(first.status, 'added')
  assert.equal(second.status, 'added')
  assert.equal(third.status, 'added')
  assert.deepEqual(await addBatchNeopleKey(client, { label: '중복', key: keys.first }), {
    status: 'duplicate'
  })

  const listed = await readBatchNeopleKeys(client)
  assert.deepEqual(
    listed.map(({ label, keySuffix, enabled, rejectedAt }) => ({
      label,
      keySuffix,
      enabled,
      rejectedAt
    })),
    [
      { label: '첫째', keySuffix: 'a1b2', enabled: true, rejectedAt: null },
      { label: '둘째', keySuffix: 'c3d4', enabled: true, rejectedAt: null },
      { label: '셋째', keySuffix: 'e5f6', enabled: true, rejectedAt: null }
    ]
  )
  assert(listed.every(({ createdAt }) => createdAt instanceof Date))
  const listedText = JSON.stringify(listed)
  for (const key of Object.values(keys)) {
    assert.equal(listedText.includes(key), false, key)
  }

  assert.equal(await setBatchNeopleKeyEnabled(client, second.id, false), true)
  await recordBatchNeopleKeyRejected(client, third.id)
  assert.deepEqual(await readUsableBatchNeopleKeys(client), [{ id: first.id, key: keys.first }])
  const rejected = (await readBatchNeopleKeys(client)).find(({ id }) => id === third.id)
  assert(rejected?.rejectedAt instanceof Date)

  assert.equal(await setBatchNeopleKeyEnabled(client, third.id, true), true)
  assert.equal(await setBatchNeopleKeyEnabled(client, second.id, true), true)
  assert.deepEqual(await readUsableBatchNeopleKeys(client), [
    { id: first.id, key: keys.first },
    { id: second.id, key: keys.second },
    { id: third.id, key: keys.third }
  ])

  assert.equal(await deleteBatchNeopleKey(client, first.id), true)
  assert.equal(await deleteBatchNeopleKey(client, first.id), false)
  assert.equal(await setBatchNeopleKeyEnabled(client, first.id, true), false)
  assert.deepEqual(
    (await readBatchNeopleKeys(client)).map(({ id }) => id),
    [second.id, third.id]
  )
  assert.deepEqual(await readUsableBatchNeopleKeys(client), [
    { id: second.id, key: keys.second },
    { id: third.id, key: keys.third }
  ])
})
