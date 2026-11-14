import assert from 'node:assert/strict'
import { setTimeout } from 'node:timers/promises'

const ops = 'http://127.0.0.1:3001'
const timeout = () => AbortSignal.timeout(5000)
const get = (path, origin = ops) => fetch(`${origin}${path}`, { signal: timeout() })
const send = (method, path, body, contentType = 'application/json') =>
  fetch(`${ops}${path}`, {
    method,
    headers: { 'Content-Type': contentType },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: timeout()
  })
const post = (path, body, contentType) => send('POST', path, body, contentType)
const readJob = async (name) => {
  const response = await get('/api/jobs')
  assert.equal(response.status, 200)
  const { workerSeenAt, jobs } = await response.json()
  assert.notEqual(workerSeenAt, null)

  return jobs.find((job) => job.name === name)
}

// 운영 app 컨테이너를 띄운 직후에 실행되므로 listen할 때까지 기다린다.
for (let attempt = 1; ; attempt += 1) {
  try {
    await fetch(`${ops}/api/queues`, { signal: timeout() })
    break
  } catch (error) {
    if (attempt === 50) {
      throw error
    }

    await setTimeout(200)
  }
}

const cleanup = await readJob('job-run-cleanup')
assert.equal(cleanup.schedule, '0 4 * * *')
assert.equal(cleanup.paused, false)
assert.ok(Date.parse(cleanup.nextRunAt) > Date.now())
assert.equal(cleanup.argsSchema.type, 'object')
assert.equal(cleanup.activeRun, null)
assert.deepEqual(
  [cleanup.lastFinishedRun.trigger, cleanup.lastFinishedRun.status],
  ['manual', 'succeeded']
)

const requested = await post('/api/jobs/job-run-cleanup/runs', { args: { probe: true } })
assert.equal(requested.status, 202)
const { id } = await requested.json()
const repeated = await post('/api/jobs/job-run-cleanup/runs', {})
assert.equal(repeated.status, 409)
assert.deepEqual(await repeated.json(), { error: { code: 'JOB_ALREADY_RUNNING' } })
const active = (await readJob('job-run-cleanup')).activeRun
assert.deepEqual([active.id, active.status, active.trigger], [id, 'requested', 'manual'])
const page = await (await get('/api/jobs/job-run-cleanup/runs?limit=1')).json()
assert.deepEqual([page.runs.map((run) => run.id), page.nextBefore], [[id], id])
const older = await (await get(`/api/jobs/job-run-cleanup/runs?before=${id}`)).json()
assert.ok(older.runs.length > 0 && older.runs.every((run) => run.id < id))
assert.equal((await post('/api/jobs/missing/runs', {})).status, 404)

assert.equal((await post('/api/jobs/job-run-cleanup/pause')).status, 204)
const paused = await readJob('job-run-cleanup')
assert.deepEqual([paused.paused, paused.nextRunAt], [true, null])
assert.equal((await post('/api/jobs/job-run-cleanup/resume')).status, 204)
const resumed = await readJob('job-run-cleanup')
assert.deepEqual([resumed.paused, resumed.nextRunAt], [false, cleanup.nextRunAt])
const unscheduled = await post('/api/jobs/ops-probe/pause')
assert.equal(unscheduled.status, 400)
assert.deepEqual(await unscheduled.json(), { error: { code: 'JOB_NOT_SCHEDULED' } })

assert.equal((await post('/api/jobs/ops-probe/runs', 'x', 'text/plain')).status, 415)
assert.equal((await get('/api/jobs', 'http://127.0.0.1:3000')).status, 404)

const queues = await get('/api/queues')
assert.equal(queues.status, 200)
assert.deepEqual(await queues.json(), {
  queues: [
    { name: 'timeline-sync', waiting: 0, running: 0 },
    { name: 'enhancement-backfill', waiting: 0, running: 0 },
    { name: 'season-backfill', waiting: 0, running: 0 }
  ]
})
const readCollection = async () => {
  const response = await get('/api/collection')
  assert.equal(response.status, 200)

  return response.json()
}
assert.deepEqual(await readCollection(), {
  waiting: 1,
  oldestQueuedAt: '2026-11-09T00:00:00.000Z',
  failures: [
    { failure: 'neople-api', count: 1, lastAttemptedAt: '2026-11-08T01:00:00.000Z' },
    { failure: 'neople-internal', count: 1, lastAttemptedAt: '2026-11-08T02:00:00.000Z' }
  ]
})
const requeueInternal = await post('/api/collection/requeue', { failure: 'neople-internal' })
assert.equal(requeueInternal.status, 200)
assert.deepEqual(await requeueInternal.json(), { requeued: 1 })
const afterInternal = await readCollection()
assert.deepEqual(
  [afterInternal.waiting, afterInternal.failures.map(({ failure }) => failure)],
  [2, ['neople-api']]
)
const requeueAll = await post('/api/collection/requeue', {})
assert.deepEqual([requeueAll.status, await requeueAll.json()], [200, { requeued: 1 }])
assert.deepEqual(await readCollection(), {
  waiting: 3,
  oldestQueuedAt: '2026-11-08T00:00:00.000Z',
  failures: []
})
for (const path of ['/api/queues', '/api/collection']) {
  assert.equal((await get(path, 'http://127.0.0.1:3000')).status, 404, path)
}

// 합성 key다. 실제 Neople key가 아니다.
const batchKey = 'synthetic-container-batch-key-4e7d'
const readBatchKeys = async () => {
  const response = await get('/api/batch-neople-keys')
  assert.equal(response.status, 200)
  const text = await response.text()
  assert.equal(text.includes(batchKey), false)

  return JSON.parse(text).keys
}
const addedKey = await post('/api/batch-neople-keys', { label: 'probe', key: batchKey })
assert.equal(addedKey.status, 201)
const { id: batchKeyId } = await addedKey.json()
const duplicateKey = await post('/api/batch-neople-keys', { label: 'again', key: batchKey })
assert.deepEqual(
  [duplicateKey.status, await duplicateKey.json()],
  [409, { error: { code: 'BATCH_NEOPLE_KEY_DUPLICATE' } }]
)
assert.equal((await post('/api/batch-neople-keys', { label: 'blank', key: '  ' })).status, 400)
const [listedKey, ...otherKeys] = await readBatchKeys()
assert.deepEqual(otherKeys, [])
assert.deepEqual(
  [listedKey.id, listedKey.label, listedKey.keySuffix, listedKey.enabled, listedKey.rejectedAt],
  [batchKeyId, 'probe', '4e7d', true, null]
)
assert.ok(Date.parse(listedKey.createdAt) <= Date.now())
assert.equal((await post(`/api/batch-neople-keys/${batchKeyId}/disable`)).status, 204)
assert.equal((await readBatchKeys())[0].enabled, false)
assert.equal((await post(`/api/batch-neople-keys/${batchKeyId}/enable`)).status, 204)
assert.equal((await readBatchKeys())[0].enabled, true)
assert.equal((await send('DELETE', `/api/batch-neople-keys/${batchKeyId}`)).status, 204)
assert.deepEqual(await readBatchKeys(), [])
assert.equal((await send('DELETE', `/api/batch-neople-keys/${batchKeyId}`)).status, 404)
// 남은 행은 container-database.mjs가 DB로 확인한다.
assert.equal((await post('/api/batch-neople-keys', { label: 'stored', key: batchKey })).status, 201)
assert.equal((await get('/api/batch-neople-keys', 'http://127.0.0.1:3000')).status, 404)
