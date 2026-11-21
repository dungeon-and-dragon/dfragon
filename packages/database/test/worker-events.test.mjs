import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import {
  applyMigrations,
  createDatabaseClient,
  deleteWorkerEventsBefore,
  recordWorkerEvents
} from '../dist/index.js'

const port = process.env.DFRAGON_TEST_WORKER_EVENTS_PORT
const database = 'worker_events'

const connect = (name) =>
  createDatabaseClient({
    host: '127.0.0.1',
    port: Number(port),
    database: name,
    username: 'events_test',
    password: 'synthetic'
  })

let client

before(async () => {
  if (port === undefined) {
    return
  }

  const admin = connect('events_test')

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
    DB_USERNAME: 'events_test',
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

test('worker 이벤트를 저장하고, 기준 시각 전의 이벤트만 지움', {
  skip: port === undefined
}, async () => {
  await recordWorkerEvents(client, [
    {
      occurredAt: new Date('2026-10-01T00:00:00Z'),
      code: 'SCORE_NEOPLE_UNAVAILABLE',
      details: { unavailable: 3, paused: 0 }
    },
    {
      occurredAt: new Date('2026-11-21T00:00:00Z'),
      code: 'BATCH_NEOPLE_REQUEST_FAILURES',
      details: { reasons: 'timeout=2' }
    }
  ])

  const stored = async () =>
    (await client.workerEvent.findMany({ orderBy: { occurredAt: 'asc' } })).map(
      ({ occurredAt, code, details }) => ({ occurredAt, code, details })
    )

  assert.equal(await deleteWorkerEventsBefore(client, new Date('2026-10-22T00:00:00Z')), 1)
  assert.deepEqual(await stored(), [
    {
      occurredAt: new Date('2026-11-21T00:00:00Z'),
      code: 'BATCH_NEOPLE_REQUEST_FAILURES',
      details: { reasons: 'timeout=2' }
    }
  ])
})
