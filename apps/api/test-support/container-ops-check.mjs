import assert from 'node:assert/strict'

const ops = 'http://127.0.0.1:3001'
const timeout = () => AbortSignal.timeout(5000)
const get = (path, origin = ops) => fetch(`${origin}${path}`, { signal: timeout() })
const post = (path, body, contentType = 'application/json') =>
  fetch(`${ops}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: timeout()
  })
const readJob = async (name) => {
  const response = await get('/api/jobs')
  assert.equal(response.status, 200)
  const { workerSeenAt, jobs } = await response.json()
  assert.notEqual(workerSeenAt, null)

  return jobs.find((job) => job.name === name)
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
