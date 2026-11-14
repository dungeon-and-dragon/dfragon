import assert from 'node:assert/strict'
import test from 'node:test'
import { createDatabaseClient } from '../dist/index.js'

// 실제 PostgreSQL에서 pg 연결 풀 설정이 적용되는지 본다. 계정은 합성 값이다.
const port = process.env.DFRAGON_TEST_CLIENT_POOL_PORT
const configuration = {
  host: '127.0.0.1',
  port: Number(port),
  database: 'pool_test',
  username: 'pool_test',
  password: 'synthetic'
}

async function untilRunning(observer, pattern) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const [{ running }] = await observer.$queryRaw`
      SELECT count(*)::int AS running FROM pg_stat_activity
      WHERE state = 'active' AND query LIKE ${pattern} AND pid <> pg_backend_pid()`

    if (running > 0) {
      return
    }
  }

  assert.fail('붙잡은 쿼리가 시작되지 않았다')
}

async function statementTimeout(client) {
  const [{ statement_timeout: value }] = await client.$queryRaw`SHOW statement_timeout`

  return value
}

test('pool 설정이 없으면 statement timeout 없이 연결한다', {
  skip: port === undefined
}, async (t) => {
  const client = createDatabaseClient(configuration)
  t.after(() => client.$disconnect())

  assert.equal(await statementTimeout(client), '0')
})

test('statement timeout을 넘긴 쿼리는 끊긴다', { skip: port === undefined }, async (t) => {
  const client = createDatabaseClient(configuration, { statementTimeoutMs: 200 })
  t.after(() => client.$disconnect())

  assert.equal(await statementTimeout(client), '200ms')
  await assert.rejects(client.$queryRaw`SELECT pg_sleep(2)::text`, /statement timeout/)
  assert.equal(await statementTimeout(client), '200ms')
})

test('연결을 모두 쓰는 동안 온 쿼리는 연결 대기 상한까지만 기다리고 실패한다', {
  skip: port === undefined
}, async (t) => {
  const client = createDatabaseClient(configuration, {
    maxConnections: 1,
    connectionTimeoutMs: 200
  })
  const observer = createDatabaseClient(configuration)
  t.after(() => Promise.all([client.$disconnect(), observer.$disconnect()]))

  // Prisma 쿼리는 then을 부를 때 시작한다.
  const holding = Promise.resolve(client.$queryRaw`SELECT pg_sleep(1)::text AS "held"`)
  await untilRunning(observer, '%pg_sleep(1)::text AS "held"%')
  const started = performance.now()

  await assert.rejects(client.$queryRaw`SELECT 1`, /timeout exceeded when trying to connect/)
  assert.ok(performance.now() - started < 900)
  await holding
})
