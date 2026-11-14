import assert from 'node:assert/strict'
import test from 'node:test'
import type { JobOverview, JobRunRecord } from '@dfragon/database'
import { createOpsHttpApp } from '../src/runtime/ops-app.js'
import type { OpsBatchNeopleKeyStore } from '../src/application/batch-neople-keys/ports.js'
import type { OpsJobStore } from '../src/application/jobs/ports.js'

type StoredJob = Omit<JobOverview, 'activeRun' | 'lastFinishedRun'>
type StoredRun = JobRunRecord & { jobName: string }

const isActive = (run: StoredRun) => run.status === 'requested' || run.status === 'running'

// DB 함수(readJobOverviews 등)의 반환 계약과 같은 job의 요청, 실행 중 행을 하나만 두는 제약을 메모리에 흉내 낸 fake이며 DB를 쓰지 않는다.
function memoryOpsJobStore(jobs: StoredJob[], runs: StoredRun[] = []): OpsJobStore {
  const find = (name: string) => jobs.find((job) => job.name === name)
  const record = ({ jobName: _jobName, ...run }: StoredRun): JobRunRecord => run

  return {
    readOverviews: async () =>
      jobs.map((job) => {
        const own = runs.filter((run) => run.jobName === job.name)
        const active = own.find(isActive)
        const finished = own
          .filter((run) => run.finishedAt !== null)
          .sort((a, b) => Number(b.finishedAt) - Number(a.finishedAt))[0]
        const activeRun = active === undefined ? null : record(active)
        const lastFinishedRun = finished === undefined ? null : record(finished)

        return { ...job, activeRun, lastFinishedRun }
      }),
    readRuns: async (name, { before, limit }) => {
      if (find(name) === undefined) {
        return undefined
      }

      return runs
        .filter((run) => run.jobName === name && (before === undefined || run.id < before))
        .sort((a, b) => b.id - a.id)
        .slice(0, limit)
        .map(record)
    },
    requestRun: async (name, args) => {
      if (find(name) === undefined) {
        return { status: 'not-found' }
      }

      if (runs.some((run) => run.jobName === name && isActive(run))) {
        return { status: 'active' }
      }
      const id = Math.max(0, ...runs.map((run) => run.id)) + 1
      runs.push(storedRun({ id, jobName: name, trigger: 'manual', status: 'requested', args }))

      return { status: 'requested', id }
    },
    setPaused: async (name, paused) => {
      const job = find(name)
      if (job === undefined) {
        return 'not-found'
      }

      if (job.schedule === null) {
        return 'not-scheduled'
      }
      job.pausedAt = paused ? new Date('2026-11-10T03:00:00Z') : null

      return 'updated'
    }
  }
}

function storedJob(overrides: Partial<StoredJob> & Pick<StoredJob, 'name'>): StoredJob {
  return {
    displayName: overrides.name,
    description: '',
    schedule: '0 0 * * *',
    argsSchema: { type: 'object' },
    delayMinutes: 10,
    pausedAt: null,
    nextRunAt: new Date('2026-11-10T15:00:00Z'),
    workerSeenAt: new Date('2026-11-10T02:00:00Z'),
    ...overrides
  }
}

function storedRun(overrides: Partial<StoredRun> & Pick<StoredRun, 'id' | 'jobName'>): StoredRun {
  return {
    trigger: 'schedule',
    status: 'succeeded',
    args: {},
    requestedAt: new Date('2026-11-09T15:00:00Z'),
    startedAt: new Date('2026-11-09T15:00:00Z'),
    finishedAt: new Date('2026-11-09T15:05:00Z'),
    progressDone: null,
    progressTotal: null,
    summary: null,
    error: null,
    ...overrides
  }
}

const unusedCollection = async () => assert.fail('job 경로 테스트는 수집 대기열을 읽으면 안 된다')

const unusedBatchNeopleKeys = async () =>
  assert.fail('job 경로 테스트는 batch key를 다루면 안 된다')
const unusedBatchNeopleKeyStore: OpsBatchNeopleKeyStore = {
  readKeys: unusedBatchNeopleKeys,
  add: unusedBatchNeopleKeys,
  setEnabled: unusedBatchNeopleKeys,
  delete: unusedBatchNeopleKeys
}

async function startOpsApp(t: test.TestContext, store: OpsJobStore, logs: string[] = []) {
  const app = await createOpsHttpApp({
    jobs: store,
    readQueueCounts: () => assert.fail('job 경로 테스트는 queue를 읽으면 안 된다'),
    collection: { readSummary: unusedCollection, requeue: unusedCollection },
    batchNeopleKeys: unusedBatchNeopleKeyStore,
    writeAccessLog: (line) => logs.push(line)
  })
  t.after(() => app.close())
  await app.listen(0, '127.0.0.1')
  const origin = await app.getUrl()

  return (path: string, init: RequestInit = {}) => fetch(`${origin}${path}`, init)
}

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
})

test('job 목록은 정지 여부, 정지 중 다음 실행 null, 진행률, 마지막 실행과 가장 최근 worker 시각을 준다', async (t) => {
  const request = await startOpsApp(
    t,
    memoryOpsJobStore(
      [
        storedJob({
          name: 'stats',
          description: '통계를 저장합니다.',
          workerSeenAt: new Date('2026-11-10T02:00:00Z')
        }),
        storedJob({
          name: 'skill-adoption',
          pausedAt: new Date('2026-11-10T01:00:00Z'),
          workerSeenAt: new Date('2026-11-10T02:01:00Z')
        }),
        storedJob({ name: 'backfill', schedule: null, nextRunAt: null })
      ],
      [
        storedRun({ id: 1, jobName: 'stats', summary: { rows: 3 } }),
        storedRun({
          id: 2,
          jobName: 'stats',
          trigger: 'manual',
          status: 'running',
          finishedAt: null,
          progressDone: 40,
          progressTotal: 100
        }),
        storedRun({
          id: 3,
          jobName: 'backfill',
          trigger: 'manual',
          status: 'failed',
          error: [{ name: 'TypeError', code: 'ERR_X' }]
        })
      ]
    )
  )

  const response = await request('/api/jobs')

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const body = await response.json()
  assert.equal(body.workerSeenAt, '2026-11-10T02:01:00.000Z')
  const [stats, skillAdoption, backfill] = body.jobs
  assert.deepEqual(stats, {
    name: 'stats',
    displayName: 'stats',
    description: '통계를 저장합니다.',
    schedule: '0 0 * * *',
    paused: false,
    nextRunAt: '2026-11-10T15:00:00.000Z',
    argsSchema: { type: 'object' },
    delayMinutes: 10,
    activeRun: {
      id: 2,
      trigger: 'manual',
      status: 'running',
      args: {},
      requestedAt: '2026-11-09T15:00:00.000Z',
      startedAt: '2026-11-09T15:00:00.000Z',
      finishedAt: null,
      progress: { done: 40, total: 100 },
      summary: null,
      error: null
    },
    lastFinishedRun: {
      id: 1,
      trigger: 'schedule',
      status: 'succeeded',
      args: {},
      requestedAt: '2026-11-09T15:00:00.000Z',
      startedAt: '2026-11-09T15:00:00.000Z',
      finishedAt: '2026-11-09T15:05:00.000Z',
      progress: null,
      summary: { rows: 3 },
      error: null
    }
  })
  assert.equal(skillAdoption.paused, true)
  assert.equal(skillAdoption.description, '')
  assert.equal(skillAdoption.nextRunAt, null)
  assert.equal(skillAdoption.activeRun, null)
  assert.equal(skillAdoption.lastFinishedRun, null)
  assert.equal(backfill.schedule, null)
  assert.deepEqual(backfill.lastFinishedRun.error, [{ name: 'TypeError', code: 'ERR_X' }])
})

test('job이 없으면 빈 목록과 worker 시각 null을 준다', async (t) => {
  const request = await startOpsApp(t, memoryOpsJobStore([]))

  assert.deepEqual(await (await request('/api/jobs')).json(), { workerSeenAt: null, jobs: [] })
})

test('실행 이력은 id 역순으로 before와 limit로 이어 받고 다음 쪽 기준을 준다', async (t) => {
  const runs = [1, 2, 3, 4, 5].map((id) => storedRun({ id, jobName: 'stats' }))
  const request = await startOpsApp(
    t,
    memoryOpsJobStore([storedJob({ name: 'stats' })], [...runs, storedRun({ id: 6, jobName: 'x' })])
  )
  const ids = (body: { runs: Array<{ id: number }> }) => body.runs.map(({ id }) => id)

  const first = await (await request('/api/jobs/stats/runs?limit=2')).json()
  const second = await (
    await request(`/api/jobs/stats/runs?limit=2&before=${first.nextBefore}`)
  ).json()
  const last = await (await request('/api/jobs/stats/runs?limit=2&before=2')).json()
  const all = await (await request('/api/jobs/stats/runs')).json()

  assert.deepEqual([ids(first), first.nextBefore], [[5, 4], 4])
  assert.deepEqual([ids(second), second.nextBefore], [[3, 2], 2])
  assert.deepEqual([ids(last), last.nextBefore], [[1], null])
  assert.deepEqual([ids(all), all.nextBefore], [[5, 4, 3, 2, 1], null])
})

test('실행 이력 조회는 없는 job을 404, 잘못된 before와 limit를 400으로 거절한다', async (t) => {
  const request = await startOpsApp(t, memoryOpsJobStore([storedJob({ name: 'stats' })]))

  const missing = await request('/api/jobs/missing/runs')
  assert.equal(missing.status, 404)
  assert.deepEqual(await missing.json(), { error: { code: 'JOB_NOT_FOUND' } })
  for (const query of [
    'limit=0',
    'limit=101',
    'limit=abc',
    'before=0',
    'before=-1',
    'before=1e3'
  ]) {
    const response = await request(`/api/jobs/stats/runs?${query}`)
    assert.equal(response.status, 400, query)
    assert.deepEqual(await response.json(), { error: { code: 'INVALID_OPS_REQUEST' } })
  }
})

test('수동 실행 요청은 인자와 함께 requested 행을 넣어 202를 주고, 같은 job을 다시 요청하면 409다', async (t) => {
  const runs: StoredRun[] = []
  const request = await startOpsApp(
    t,
    memoryOpsJobStore([storedJob({ name: 'stats' }), storedJob({ name: 'cleanup' })], runs)
  )

  const accepted = await request('/api/jobs/stats/runs', json({ args: { days: 3 } }))
  const repeated = await request('/api/jobs/stats/runs', json({}))
  const withoutArgs = await request('/api/jobs/cleanup/runs', json({}))
  const missing = await request('/api/jobs/missing/runs', json({}))

  assert.equal(accepted.status, 202)
  assert.deepEqual(await accepted.json(), { id: 1 })
  assert.equal(repeated.status, 409)
  assert.deepEqual(await repeated.json(), { error: { code: 'JOB_ALREADY_RUNNING' } })
  assert.equal(withoutArgs.status, 202)
  assert.equal(missing.status, 404)
  assert.deepEqual(await missing.json(), { error: { code: 'JOB_NOT_FOUND' } })
  assert.deepEqual(
    runs.map(({ jobName, trigger, status, args }) => ({ jobName, trigger, status, args })),
    [
      { jobName: 'stats', trigger: 'manual', status: 'requested', args: { days: 3 } },
      { jobName: 'cleanup', trigger: 'manual', status: 'requested', args: {} }
    ]
  )
})

test('수동 실행 요청은 JSON object가 아닌 본문을 행 없이 400으로 거절한다', async (t) => {
  const runs: StoredRun[] = []
  const request = await startOpsApp(t, memoryOpsJobStore([storedJob({ name: 'stats' })], runs))
  const headers = { 'Content-Type': 'application/json' }

  for (const body of ['[]', 'null', '"text"', '{', JSON.stringify({ args: 'x'.repeat(20_000) })]) {
    const response = await request('/api/jobs/stats/runs', { method: 'POST', headers, body })
    assert.equal(response.status, 400, body.slice(0, 10))
    assert.deepEqual(await response.json(), { error: { code: 'INVALID_OPS_REQUEST' } })
  }
  assert.deepEqual(runs, [])
})

test('GET이 아닌 요청은 Content-Type이 application/json이 아니면 경로와 상관없이 415로 거절한다', async (t) => {
  const runs: StoredRun[] = []
  const request = await startOpsApp(t, memoryOpsJobStore([storedJob({ name: 'stats' })], runs))

  for (const [path, headers] of [
    ['/api/jobs/stats/runs', { 'Content-Type': 'application/x-www-form-urlencoded' }],
    ['/api/jobs/stats/runs', { 'Content-Type': 'text/plain' }],
    ['/api/jobs/stats/runs', { 'Content-Type': 'multipart/form-data; boundary=x' }],
    ['/api/jobs/stats/pause', {}],
    ['/api/unknown', { 'Content-Type': 'text/plain' }]
  ] as const) {
    const response = await request(path, { method: 'POST', headers, body: '{}' })
    assert.equal(response.status, 415, `${path} ${JSON.stringify(headers)}`)
    assert.deepEqual(await response.json(), { error: { code: 'UNSUPPORTED_MEDIA_TYPE' } })
  }
  const withCharset = await request('/api/jobs/stats/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'Application/JSON; charset=utf-8' },
    body: '{}'
  })
  assert.equal(withCharset.status, 202)
  assert.equal(runs.length, 1)
})

test('정지한 job은 목록에서 정지로 보이고 다음 실행이 null이며 재개하면 되돌아온다', async (t) => {
  const request = await startOpsApp(
    t,
    memoryOpsJobStore([storedJob({ name: 'stats' }), storedJob({ name: 'once', schedule: null })])
  )
  const stats = async () => {
    const { jobs } = await (await request('/api/jobs')).json()

    return jobs.find((job: { name: string }) => job.name === 'stats')
  }
  const post = (path: string) =>
    request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' } })

  const paused = await post('/api/jobs/stats/pause')
  assert.equal(paused.status, 204)
  assert.deepEqual(await stats().then(({ paused, nextRunAt }) => ({ paused, nextRunAt })), {
    paused: true,
    nextRunAt: null
  })
  const resumed = await post('/api/jobs/stats/resume')
  assert.equal(resumed.status, 204)
  assert.deepEqual(await stats().then(({ paused, nextRunAt }) => ({ paused, nextRunAt })), {
    paused: false,
    nextRunAt: '2026-11-10T15:00:00.000Z'
  })
  for (const action of ['pause', 'resume']) {
    const unscheduled = await post(`/api/jobs/once/${action}`)
    assert.equal(unscheduled.status, 400)
    assert.deepEqual(await unscheduled.json(), { error: { code: 'JOB_NOT_SCHEDULED' } })
    const missing = await post(`/api/jobs/missing/${action}`)
    assert.equal(missing.status, 404)
    assert.deepEqual(await missing.json(), { error: { code: 'JOB_NOT_FOUND' } })
  }
})

test('운영 app 접근 로그는 공개 app과 다른 service 이름과 오류 code를 남긴다', async (t) => {
  const logs: string[] = []
  const request = await startOpsApp(t, memoryOpsJobStore([storedJob({ name: 'stats' })]), logs)

  await request('/api/jobs')
  await request('/api/jobs/stats/runs', { method: 'POST', body: '{}' })
  await request('/api/missing')

  assert.deepEqual(
    logs.map((line) => {
      const { service, method, route, status, code } = JSON.parse(line)

      return { service, method, route, status, code }
    }),
    [
      { service: 'api-ops', method: 'GET', route: '/api/jobs', status: 200, code: undefined },
      {
        service: 'api-ops',
        method: 'POST',
        route: '<unmatched>',
        status: 415,
        code: 'UNSUPPORTED_MEDIA_TYPE'
      },
      { service: 'api-ops', method: 'GET', route: '<unmatched>', status: 404, code: undefined }
    ]
  )
})

test('store가 실패하면 원인을 응답에 넣지 않고 500을 준다', async (t) => {
  const failing = async (): Promise<never> => {
    throw new Error('db-private-marker')
  }
  const request = await startOpsApp(t, {
    readOverviews: failing,
    readRuns: failing,
    requestRun: failing,
    setPaused: failing
  })

  const response = await request('/api/jobs')

  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), { error: { code: 'INTERNAL_SERVER_ERROR' } })
})
