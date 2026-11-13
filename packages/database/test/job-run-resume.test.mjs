import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createDatabaseClient, readLastFinishedJobRun } from '../dist/index.js'

const port = process.env.DFRAGON_TEST_JOB_RUNS_PORT

test('끝난 실행 읽기는 요청만 됐거나 실행 중인 행과 다른 job을 빼고 가장 최근에 시작한 실행을 돌려준다', {
  skip: port === undefined
}, async (t) => {
  const client = createDatabaseClient({
    host: '127.0.0.1',
    port: Number(port),
    database: 'job_run_test',
    username: 'job_run_test',
    password: 'synthetic'
  })

  t.after(() => client.$disconnect())
  await client.$executeRawUnsafe('DROP TABLE IF EXISTS "job_runs", "jobs"')

  for (const name of ['20261110180000_add_jobs', '20261111060000_add_job_description']) {
    const migration = await readFile(
      new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url),
      'utf8'
    )

    for (const statement of migration
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)) {
      await client.$executeRawUnsafe(statement)
    }
  }

  assert.equal(await readLastFinishedJobRun(client, 'score-calculation'), undefined)

  const insertRun = (jobName, status, startedAt, progressDone) => client.$executeRaw`
    INSERT INTO "job_runs" ("job_name", "trigger", "status", "args", "started_at", "progress_done")
    VALUES (${jobName}, 'schedule', ${status}, '{}'::jsonb, ${startedAt}::timestamptz, ${progressDone}::int)`

  await insertRun('score-calculation', 'succeeded', new Date('2026-11-11T13:00:00Z'), 900)
  await insertRun('score-calculation', 'failed', new Date('2026-11-17T13:00:00Z'), 120)
  await insertRun('score-calculation', 'interrupted', new Date('2026-11-18T13:00:00Z'), 412)
  await insertRun('score-calculation', 'running', new Date('2026-11-18T15:00:00Z'), 10)
  await insertRun('content-clear-collection', 'failed', new Date('2026-11-18T16:00:00Z'), 5)
  const interrupted = {
    status: 'interrupted',
    startedAt: new Date('2026-11-18T13:00:00Z'),
    progressDone: 412
  }
  assert.deepEqual(await readLastFinishedJobRun(client, 'score-calculation'), interrupted)

  // 같은 job에는 실행 중인 행과 요청 행이 함께 있을 수 없어, 실행 중인 행을 지운 뒤 운영 화면이 요청만 한 행을 넣는다.
  await client.$executeRaw`DELETE FROM "job_runs" WHERE "status" = 'running'`
  await client.$executeRaw`
    INSERT INTO "job_runs" ("job_name", "trigger", "status", "args")
    VALUES ('score-calculation', 'manual', 'requested', '{}'::jsonb)`

  assert.deepEqual(await readLastFinishedJobRun(client, 'score-calculation'), interrupted)
})
