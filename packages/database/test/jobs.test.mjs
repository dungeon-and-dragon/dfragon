import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createDatabaseClient, readJobOverviews, registerJobs } from '../dist/index.js'

const port = process.env.DFRAGON_TEST_JOBS_PORT

test('migration 기본값과 재등록 시 설명, Neople API 갱신, 정지 유지, 삭제된 job 정리', {
  skip: port === undefined
}, async (t) => {
  const client = createDatabaseClient({
    host: '127.0.0.1',
    port: Number(port),
    database: 'job_test',
    username: 'job_test',
    password: 'synthetic'
  })
  t.after(() => client.$disconnect())
  const original = await readFile(
    new URL('../prisma/migrations/20261110180000_add_jobs/migration.sql', import.meta.url),
    'utf8'
  )
  const migration = await readFile(
    new URL(
      '../prisma/migrations/20261111060000_add_job_description/migration.sql',
      import.meta.url
    ),
    'utf8'
  )
  for (const statement of original
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)) {
    await client.$executeRawUnsafe(statement)
  }
  await client.$executeRaw`INSERT INTO "jobs" ("name", "display_name", "schedule", "args_schema", "delay_minutes", "worker_seen_at") VALUES ('legacy', '기존', '0 0 * * *', '{}'::jsonb, 5, now())`
  const neopleApiMigration = await readFile(
    new URL(
      '../prisma/migrations/20261119120000_add_job_neople_apis/migration.sql',
      import.meta.url
    ),
    'utf8'
  )
  for (const statement of [migration, neopleApiMigration].flatMap((sql) =>
    sql
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
  )) {
    await client.$executeRawUnsafe(statement)
  }
  const [legacy] = await readJobOverviews(client)
  assert.equal(legacy.description, '')
  assert.equal(legacy.neopleApi, null)

  const registration = {
    name: 'legacy',
    displayName: '기존',
    description: '처음 설명',
    schedule: '0 0 * * *',
    argsSchema: {},
    delayMinutes: 5,
    neopleApi: { group: '합성 그룹', endpoints: ['/df/synthetic', '/df/other'] },
    nextRunAt: null
  }
  await registerJobs(client, [registration, { ...registration, name: 'removed' }])
  const pausedAt = new Date('2026-11-10T00:00:00Z')
  await client.job.update({ where: { name: 'legacy' }, data: { pausedAt } })
  assert.equal(
    (await readJobOverviews(client)).find(({ name }) => name === 'legacy').description,
    '처음 설명'
  )

  assert.deepEqual(
    (await readJobOverviews(client)).find(({ name }) => name === 'legacy').neopleApi,
    { group: '합성 그룹', endpoints: ['/df/synthetic', '/df/other'] }
  )

  await registerJobs(client, [{ ...registration, description: '바뀐 설명', neopleApi: null }])
  const jobs = await readJobOverviews(client)
  assert.deepEqual(
    jobs.map(({ name, description, neopleApi, pausedAt }) => ({
      name,
      description,
      neopleApi,
      pausedAt
    })),
    [{ name: 'legacy', description: '바뀐 설명', neopleApi: null, pausedAt }]
  )
})
