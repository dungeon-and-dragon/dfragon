import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyMigrations,
  createDatabaseClient,
  type DatabaseConfiguration,
  recordContentClearPopulation
} from '@dfragon/database'
import { CLEAR_CONTENTS } from '../src/domain/content-clears/contents.js'
import { createApiHttpApp } from '../src/runtime/api-app.js'
import { createApiRuntimeOptions } from '../src/runtime/application.js'
import { readRuntimeConfiguration } from '../src/runtime/configuration.js'

// 실제 PostgreSQL에서 API가 만드는 연결 풀을 쓴다. 값은 모두 합성이며 Neople은 부르지 않는다.
const port = process.env.DFRAGON_TEST_API_DATABASE_PORT
const database = 'clear_stats_pool'
const admin: DatabaseConfiguration = {
  host: '127.0.0.1',
  port: Number(port),
  database: 'pool_test',
  username: 'pool_test',
  password: 'synthetic'
}
const weekStarts = ['2026-10-22', '2026-10-29', '2026-11-05', '2026-11-12'].map(
  (date) => new Date(`${date}T06:00:00+09:00`)
)

async function prepareDatabase(): Promise<void> {
  const client = createDatabaseClient(admin)
  await client.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`)
  await client.$executeRawUnsafe(`CREATE DATABASE "${database}"`)
  await client.$disconnect()
}

async function untilLockWaiter(client: ReturnType<typeof createDatabaseClient>): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const [{ waiting }] = await client.$queryRaw<{ waiting: number }[]>`
      SELECT count(*)::int AS waiting FROM pg_stat_activity
      WHERE datname = ${database} AND wait_event_type = 'Lock'`

    if (waiting > 0) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  assert.fail('클리어 통계 쿼리가 잠금을 기다리지 않는다')
}

// 운영 장애(2026-11-14): 클리어 상세 요청이 몰려 쿼리가 오래 걸리자 다른 경로가 DB 연결을 얻지 못하고 멈췄다.
// content_clears를 잠가 클리어 통계 쿼리가 끝나지 않는 상황을 만든다.
test('클리어 통계 쿼리가 끝나지 않는 동안에도 랭킹과 통계 경로는 DB 연결을 얻어 응답한다', {
  skip: port === undefined
}, async (t) => {
  await prepareDatabase()
  const environment = {
    PORT: '3000',
    NEOPLE_API_KEY: 'synthetic-key',
    DB_HOST: admin.host,
    DB_PORT: port,
    DB_NAME: database,
    DB_USERNAME: admin.username,
    DB_PASSWORD: admin.password
  }
  const previous = { ...process.env }
  t.after(() => {
    process.env = previous
  })
  Object.assign(process.env, environment)
  await applyMigrations()

  const seed = createDatabaseClient({ ...admin, database })
  const locker = createDatabaseClient({ ...admin, database })
  t.after(() => Promise.all([seed.$disconnect(), locker.$disconnect()]))
  for (const content of CLEAR_CONTENTS) {
    for (const weekStart of weekStarts) {
      await recordContentClearPopulation(seed, {
        contentId: content.id,
        weekStart,
        population: 100,
        minFame: 100_000,
        jobs: [],
        collectedAt: new Date('2026-11-13T06:30:00+09:00'),
        closed: true
      })
    }
  }

  const { app } = await createApiHttpApp({
    ...createApiRuntimeOptions(await readRuntimeConfiguration(environment)),
    writeAccessLog: () => undefined
  })
  await app.listen(0, '127.0.0.1')
  t.after(() => app.close())
  const origin = await app.getUrl()
  const get = (path: string, timeout: number) =>
    fetch(new URL(path, origin), { signal: AbortSignal.timeout(timeout) })

  assert.equal((await get('/stats/clears', 10_000)).status, 200)

  let release!: () => void
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  let locked!: () => void
  const lockHeld = new Promise<void>((resolve) => {
    locked = resolve
  })
  const lock = locker.$transaction(
    async (tx) => {
      await tx.$executeRaw`LOCK TABLE content_clears IN ACCESS EXCLUSIVE MODE`
      locked()
      await released
    },
    { timeout: 120_000 }
  )
  await lockHeld

  // 운영 로그처럼 4초 사이에 클리어 요청 27개가 몰린다. 미리 계산하지 않는 지난 주를 고른다.
  const heavyPaths = [
    ...CLEAR_CONTENTS.flatMap(({ id }) =>
      ['2026-10-22', '2026-10-29', '2026-11-05'].map((week) => `/stats/clears/${id}?week=${week}`)
    ),
    '/stats/clears/overview?week=2026-10-22',
    '/stats/clears/overview?week=2026-10-29',
    '/stats/clears/overview?week=2026-11-05'
  ]
  const heavy = heavyPaths.map((path) => get(path, 60_000))
  try {
    await untilLockWaiter(seed)

    for (const path of ['/rankings/fame', '/stats']) {
      const response = await get(path, 5_000)
      assert.equal(response.status, 200, path)
    }
  } finally {
    release()
    await lock
  }

  const finished = await Promise.all(heavy)
  assert.deepEqual(
    finished.map(({ status }) => status),
    heavyPaths.map(() => 200)
  )
})
