import assert from 'node:assert/strict'
import test from 'node:test'
import type {
  JobRegistration,
  JobRunErrorEntry,
  JobRunProgress,
  JobRunSummary,
  JobTrigger
} from '@dfragon/database'
import { z } from 'zod'
import { type JobAlert, createDiscordJobAlert } from '../src/jobs/alert.js'
import {
  type JobDefinition,
  type JobStore,
  type ReportJobEvent,
  defineJob
} from '../src/jobs/definition.js'
import { executeJobRun } from '../src/jobs/run.js'
import {
  findCatchupJobs,
  registerWorkerJobs,
  runRequestedJobs,
  runScheduledJob
} from '../src/jobs/scheduler.js'

type StoredRun = {
  id: number
  jobName: string
  trigger: JobTrigger
  status: 'requested' | 'running' | 'succeeded' | 'failed' | 'interrupted'
  args: unknown
  startedAt: Date | null
  progress: JobRunProgress | null
  summary: JobRunSummary | null
  error: readonly JobRunErrorEntry[] | null
}

const isActive = (run: StoredRun) => run.status === 'requested' || run.status === 'running'

// DB 저장 함수의 상태 전이와 같은 job의 요청, 실행 중 행을 하나만 두는 제약을 메모리에 흉내 낸 fake이며 DB를 쓰지 않는다.
function memoryJobStore({ paused = [] as string[] } = {}) {
  const runs: StoredRun[] = []
  const registered: JobRegistration[] = []
  const pausedJobs = new Set(paused)
  const addRun = (run: Omit<StoredRun, 'id'>): number | undefined => {
    if (runs.some((stored) => stored.jobName === run.jobName && isActive(stored))) {
      return undefined
    }
    const id = runs.length + 1
    runs.push({ id, ...run })

    return id
  }
  const store: JobStore = {
    registerJobs: async (jobs) => {
      registered.splice(0, registered.length, ...jobs)
    },
    interruptRunningRuns: async () =>
      runs
        .filter((run) => run.status === 'running')
        .map((run) => {
          run.status = 'interrupted'
          assert(run.startedAt)

          return {
            id: run.id,
            jobName: run.jobName,
            trigger: run.trigger,
            startedAt: run.startedAt
          }
        }),
    isPaused: async (name) => pausedJobs.has(name),
    readLastScheduledSuccess: async (name) =>
      runs.findLast(
        (run) => run.jobName === name && run.status === 'succeeded' && run.trigger !== 'manual'
      )?.startedAt ?? undefined,
    startRun: async (jobName, trigger) =>
      addRun({ ...emptyRun(jobName, trigger, {}), status: 'running', startedAt: new Date() }),
    claimRequestedRun: async (names) => {
      const run = runs.find(
        (stored) => stored.status === 'requested' && names.includes(stored.jobName)
      )
      if (run === undefined) {
        return undefined
      }
      run.status = 'running'
      run.startedAt = new Date()

      return { id: run.id, jobName: run.jobName, args: run.args }
    },
    recordProgress: async (id, progress) => {
      findRun(id).progress = progress
    },
    finishRun: async (id, outcome) => {
      const run = findRun(id)
      run.status = outcome.status
      run.progress = outcome.progress
      run.summary = outcome.status === 'succeeded' ? outcome.summary : null
      run.error = outcome.status === 'failed' ? outcome.error : null
    },
    recordNextRun: async () => {},
    recordWorkerSeen: async () => {}
  }
  const findRun = (id: number) => {
    const run = runs.find((stored) => stored.id === id)
    assert(run)

    return run
  }

  return {
    store,
    runs,
    registered,
    request: (jobName: string, args: unknown) =>
      addRun({ ...emptyRun(jobName, 'manual', args), status: 'requested' }),
    seed: (run: Omit<StoredRun, 'id'>) => runs.push({ id: runs.length + 1, ...run })
  }
}

function emptyRun(jobName: string, trigger: JobTrigger, args: unknown): Omit<StoredRun, 'id'> {
  return {
    jobName,
    trigger,
    status: 'requested',
    args,
    startedAt: null,
    progress: null,
    summary: null,
    error: null
  }
}

function recordedAlerts() {
  const alerts: JobAlert[] = []

  return {
    alerts,
    alert: async (jobAlert: JobAlert) => {
      alerts.push(jobAlert)
    }
  }
}

function recordedEvents() {
  const events: Array<{ code: string; job?: string; reason?: string }> = []

  const report: ReportJobEvent = (code, details) => {
    events.push({ code, job: details.job, reason: details.reason })
  }

  return { events, report }
}

class SyntheticFailure extends Error {
  readonly code = 'SYNTHETIC_FAILURE'

  constructor() {
    super('synthetic message with request value')
    this.name = 'SyntheticFailure'
  }
}

const dailyJob = defineJob({
  name: 'daily',
  displayName: '매일',
  description: '매일 실행합니다.',
  schedule: '0 4 * * *',
  argsSchema: z.object({ limit: z.number().int().positive().default(10) }),
  delayMinutes: 5,
  run: async ({ limit }, { reportProgress }) => {
    reportProgress(limit, limit)

    return { processed: limit }
  }
})

const failingJob = defineJob({
  name: 'failing',
  displayName: '실패',
  description: '실패합니다.',
  argsSchema: z.object({}),
  delayMinutes: 5,
  run: async () => {
    throw new SyntheticFailure()
  }
})

// 2026-11-10 12:00(KST). 매일 job의 직전 예정 시각은 같은 날 04:00(KST)이다.
const now = new Date('2026-11-10T03:00:00Z')

test('성공한 실행은 succeeded와 결과 요약, 끝의 진행률을 남긴다', async () => {
  const { store, runs } = memoryJobStore()
  const { events, report } = recordedEvents()

  await runScheduledJob(dailyJob, 'schedule', { store, report })

  assert.deepEqual(
    runs.map(({ status, trigger, summary, progress }) => ({ status, trigger, summary, progress })),
    [
      {
        status: 'succeeded',
        trigger: 'schedule',
        summary: { processed: 10 },
        progress: { done: 10, total: 10 }
      }
    ]
  )
  assert.deepEqual(
    events.map(({ code }) => code),
    ['JOB_RUN_STARTED', 'JOB_RUN_SUCCEEDED']
  )
})

test('예외를 던진 실행은 failed와 오류 name, code만 남기고 message는 남기지 않는다', async () => {
  const { store, runs } = memoryJobStore()
  const { events, report } = recordedEvents()
  const id = await store.startRun(failingJob.name, 'catchup')
  assert(id !== undefined)

  await executeJobRun(failingJob, { id, trigger: 'catchup', args: {} }, { store, report })

  const [run] = runs
  assert.equal(run?.status, 'failed')
  assert.deepEqual(
    run.error?.map(({ name, code }) => ({ name, code })),
    [{ name: 'SyntheticFailure', code: 'SYNTHETIC_FAILURE' }]
  )
  assert.doesNotMatch(JSON.stringify(run.error), /synthetic message/)
  assert.deepEqual(
    events.map(({ code }) => code),
    ['JOB_RUN_STARTED', 'JOB_RUN_FAILED']
  )
})

test('이력을 쓰지 못해도 실행은 reject하지 않고 기록 실패를 로그로 남긴다', async () => {
  const { store } = memoryJobStore()
  const { events, report } = recordedEvents()
  const brokenStore: JobStore = {
    ...store,
    finishRun: async () => {
      throw new SyntheticFailure()
    }
  }

  await runScheduledJob(failingJob, 'catchup', { store: brokenStore, report })

  assert.deepEqual(
    events.map(({ code }) => code),
    ['JOB_RUN_STARTED', 'JOB_RUN_FAILED', 'JOB_RUN_RECORD_FAILED']
  )
})

test('같은 job의 요청이나 실행 중인 행이 있으면 정기 실행은 행을 만들지 않고 건너뛴다', async () => {
  const { store, runs, request } = memoryJobStore()
  const { events, report } = recordedEvents()
  request(dailyJob.name, {})

  await runScheduledJob(dailyJob, 'schedule', { store, report })

  assert.deepEqual(
    runs.map(({ status, trigger }) => ({ status, trigger })),
    [{ status: 'requested', trigger: 'manual' }]
  )
  assert.deepEqual(events, [{ code: 'JOB_RUN_SKIPPED', job: 'daily', reason: 'active' }])
})

test('시작할 때 job 목록을 올리고 running으로 남은 행을 interrupted로 바꾼다', async () => {
  const { store, runs, registered, seed } = memoryJobStore()
  const { events, report } = recordedEvents()
  seed({ ...emptyRun(dailyJob.name, 'schedule', {}), status: 'running', startedAt: now })
  seed({ ...emptyRun(dailyJob.name, 'schedule', {}), status: 'succeeded', startedAt: now })

  await registerWorkerJobs({ jobs: [dailyJob, failingJob], store, report }, now)

  assert.deepEqual(
    runs.map(({ status }) => status),
    ['interrupted', 'succeeded']
  )
  assert.deepEqual(events, [{ code: 'JOB_RUN_INTERRUPTED', job: 'daily', reason: undefined }])
  assert.deepEqual(
    registered.map(({ name, schedule, nextRunAt }) => ({ name, schedule, nextRunAt })),
    [
      { name: 'daily', schedule: '0 4 * * *', nextRunAt: new Date('2026-11-10T19:00:00Z') },
      { name: 'failing', schedule: null, nextRunAt: null }
    ]
  )
  assert.equal(registered[0]?.delayMinutes, 5)
  assert.equal(registered[0]?.description, '매일 실행합니다.')
  assert.deepEqual(registered[0]?.argsSchema, {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    properties: {
      limit: { default: 10, type: 'integer', exclusiveMinimum: 0, maximum: Number.MAX_SAFE_INTEGER }
    },
    required: ['limit'],
    additionalProperties: false
  })
})

test('보충은 수동이 아닌 마지막 성공 뒤의 다음 예정 시각이 지난 정기 job만 한 번 든다', async (t) => {
  const cases: Array<{ name: string; lastSuccess?: Date; manualSuccess?: Date; due: boolean }> = [
    { name: '이틀 전 성공', lastSuccess: new Date('2026-11-07T19:00:01Z'), due: true },
    { name: '어제 예정 시각 뒤 성공', lastSuccess: new Date('2026-11-08T20:00:00Z'), due: true },
    { name: '오늘 예정 시각 뒤 성공', lastSuccess: new Date('2026-11-09T19:00:01Z'), due: false },
    { name: '성공 이력 없음', due: true },
    {
      name: '오늘 수동 성공만 있음',
      manualSuccess: new Date('2026-11-09T20:00:00Z'),
      due: true
    }
  ]
  for (const { name, lastSuccess, manualSuccess, due } of cases) {
    await t.test(name, async () => {
      const { store, seed } = memoryJobStore()
      if (lastSuccess !== undefined) {
        seed({ ...emptyRun('daily', 'schedule', {}), status: 'succeeded', startedAt: lastSuccess })
      }

      if (manualSuccess !== undefined) {
        seed({ ...emptyRun('daily', 'manual', {}), status: 'succeeded', startedAt: manualSuccess })
      }
      const { report } = recordedEvents()

      const catchup = await findCatchupJobs({ jobs: [dailyJob, failingJob], store, report }, now)

      assert.deepEqual(
        catchup.map(({ name: jobName }) => jobName),
        due ? ['daily'] : []
      )
    })
  }
})

test('정지된 job은 보충과 정기 실행을 건너뛰고 요청 행은 실행한다', async () => {
  const { store, runs, request } = memoryJobStore({ paused: ['daily'] })
  const { events, report } = recordedEvents()
  const dependencies = { jobs: [dailyJob], store, report }

  assert.deepEqual(await findCatchupJobs(dependencies, now), [])
  await runScheduledJob(dailyJob, 'schedule', { store, report })
  assert.deepEqual(events, [{ code: 'JOB_RUN_SKIPPED', job: 'daily', reason: 'paused' }])
  assert.deepEqual(runs, [])

  request(dailyJob.name, { limit: 3 })
  await runRequestedJobs(dependencies)

  assert.deepEqual(
    runs.map(({ status, trigger, summary }) => ({ status, trigger, summary })),
    [{ status: 'succeeded', trigger: 'manual', summary: { processed: 3 } }]
  )
})

test('요청 행은 running을 거쳐 succeeded가 되고, schema에 맞지 않는 인자는 INVALID_JOB_ARGS로 끝난다', async () => {
  const { store, runs, request } = memoryJobStore()
  const { report } = recordedEvents()
  const statusesDuringRun: string[] = []
  const observedJob: JobDefinition = defineJob({
    name: 'observed',
    displayName: '관찰',
    description: '실행을 관찰합니다.',
    argsSchema: z.object({ target: z.string() }),
    delayMinutes: 5,
    run: async () => {
      statusesDuringRun.push(
        ...runs.filter(({ jobName }) => jobName === 'observed').map(({ status }) => status)
      )

      return undefined
    }
  })
  request(observedJob.name, { target: 'cain' })
  request(dailyJob.name, { limit: 'many' })

  await runRequestedJobs({ jobs: [observedJob, dailyJob], store, report })

  assert.deepEqual(statusesDuringRun, ['running'])
  assert.deepEqual(
    runs.map(({ jobName, status, summary, error }) => ({
      jobName,
      status,
      summary,
      errorCodes: error?.map(({ code }) => code)
    })),
    [
      { jobName: 'observed', status: 'succeeded', summary: null, errorCodes: undefined },
      { jobName: 'daily', status: 'failed', summary: null, errorCodes: ['INVALID_JOB_ARGS'] }
    ]
  )
})

test('실패한 실행만 job 이름, 계기, 오류 name과 code로 실패 알림을 한 번 보낸다', async () => {
  const { store } = memoryJobStore()
  const { report } = recordedEvents()
  const { alerts, alert } = recordedAlerts()

  await runScheduledJob(failingJob, 'catchup', { store, report, alert })
  await runScheduledJob(dailyJob, 'schedule', { store, report, alert })

  assert.deepEqual(
    alerts.map(({ kind, job, trigger, errorChain }) => ({
      kind,
      job,
      trigger,
      errors: errorChain?.map(({ name, code }) => ({ name, code }))
    })),
    [
      {
        kind: 'failed',
        job: 'failing',
        trigger: 'catchup',
        errors: [{ name: 'SyntheticFailure', code: 'SYNTHETIC_FAILURE' }]
      }
    ]
  )
})

test('시작할 때 interrupted로 바꾼 실행마다 중단 알림을 보낸다', async () => {
  const { store, seed } = memoryJobStore()
  const { report } = recordedEvents()
  const { alerts, alert } = recordedAlerts()
  seed({
    ...emptyRun(dailyJob.name, 'schedule', {}),
    status: 'running',
    startedAt: new Date(now.getTime() - 90_000)
  })
  seed({ ...emptyRun(dailyJob.name, 'manual', {}), status: 'succeeded', startedAt: now })

  await registerWorkerJobs({ jobs: [dailyJob], store, report, alert }, now)

  assert.deepEqual(alerts, [
    { kind: 'interrupted', job: 'daily', trigger: 'schedule', elapsedMs: 90_000 }
  ])
})

test('지연 기준 전에 끝난 실행은 지연 알림을 보내지 않는다', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] })
  const { store } = memoryJobStore()
  const { report } = recordedEvents()
  const { alerts, alert } = recordedAlerts()

  await runScheduledJob(dailyJob, 'schedule', { store, report, alert })
  t.mock.timers.tick(30 * 60_000)

  assert.deepEqual(alerts, [])
})

test('지연 기준을 넘겨도 실행 중이면 지연 알림을 그 실행에 한 번만 보낸다', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] })
  const { store } = memoryJobStore()
  const { report } = recordedEvents()
  const { alerts, alert } = recordedAlerts()
  let resolve = () => {}
  const finish = new Promise<void>((settle) => {
    resolve = settle
  })
  const slowJob = defineJob({
    name: 'slow',
    displayName: '느림',
    description: '천천히 실행합니다.',
    argsSchema: z.object({}),
    delayMinutes: 5,
    run: async () => {
      await finish

      return undefined
    }
  })
  const id = await store.startRun(slowJob.name, 'schedule')
  assert(id !== undefined)

  const running = executeJobRun(
    slowJob,
    { id, trigger: 'schedule', args: {} },
    {
      store,
      report,
      alert
    }
  )
  t.mock.timers.tick(5 * 60_000)
  t.mock.timers.tick(30 * 60_000)
  resolve()
  await running

  assert.deepEqual(alerts, [
    { kind: 'delayed', job: 'slow', trigger: 'schedule', elapsedMs: 5 * 60_000 }
  ])
})

test('알림 전송이 실패해도 실행의 상태와 이력은 그대로이고 전송 실패만 로그로 남긴다', async () => {
  const { store, runs } = memoryJobStore()
  const { events, report } = recordedEvents()
  const brokenAlert = async () => {
    throw new SyntheticFailure()
  }

  await runScheduledJob(failingJob, 'catchup', { store, report, alert: brokenAlert })

  assert.deepEqual(
    runs.map(({ status, error }) => ({ status, errorCodes: error?.map(({ code }) => code) })),
    [{ status: 'failed', errorCodes: ['SYNTHETIC_FAILURE'] }]
  )
  assert.deepEqual(
    events.map(({ code }) => code),
    ['JOB_RUN_STARTED', 'JOB_RUN_FAILED', 'JOB_ALERT_FAILED']
  )
})

test('Discord 알림 본문에는 오류 message와 실행 인자가 없다', async () => {
  const { store, request } = memoryJobStore()
  const { report } = recordedEvents()
  const bodies: unknown[] = []
  // 실제 Discord로 보내지 않는 가짜 fetch이며 URL은 합성 값이다.
  const fakeFetch: typeof fetch = async (input, init) => {
    bodies.push(await new Request(input, init).json())

    return new Response(null, { status: 204 })
  }
  const alert = createDiscordJobAlert('https://discord.test/api/webhooks/synthetic', fakeFetch)
  const argumentJob = defineJob({
    name: 'with-args',
    displayName: '인자',
    description: '인자를 받습니다.',
    argsSchema: z.object({ target: z.string() }),
    delayMinutes: 5,
    run: async () => {
      throw new SyntheticFailure()
    }
  })
  request(argumentJob.name, { target: 'synthetic-argument-value' })

  await runRequestedJobs({ jobs: [argumentJob], store, report, alert })

  assert.equal(bodies.length, 1)
  const serialized = JSON.stringify(bodies[0])
  assert.match(serialized, /with-args/)
  assert.match(serialized, /manual/)
  assert.match(serialized, /SyntheticFailure\(SYNTHETIC_FAILURE\)/)
  assert.doesNotMatch(serialized, /synthetic message|synthetic-argument-value/)
})
