import assert from 'node:assert/strict'
import { once } from 'node:events'
import { get } from 'node:http'
import test from 'node:test'
import type { OpsBatchNeopleKeyStore, OpsJobStore } from '../src/application/ops/ports.js'
import { type OpsHttpAppOptions, createOpsHttpApp } from '../src/runtime/ops-app.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

// 로그에 나오면 안 되는 요청 값이다. 모두 합성 값이며 실제 credential이 아니다.
const secrets = {
  token: 'fake-bearer-token-7f3a',
  cookie: 'fake-cookie-value-91bd',
  query: 'fake-query-secret-4c2e',
  pathValue: 'fake-path-job-8d1f',
  bodyValue: 'fake-body-argument-2a6e',
  errorDetail: 'fake-internal-detail-0b6c',
  clientCorrelationId: 'client-chosen-id-5e9a'
}
const sensitiveHeaders = {
  Authorization: `Bearer ${secrets.token}`,
  Cookie: `session=${secrets.cookie}`,
  'X-Correlation-Id': secrets.clientCorrelationId
}

function gate() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })

  return { promise, release }
}

function collectAccessLogs() {
  const lines: string[] = []
  let notify: (() => void) | undefined
  const sink = (line: string): void => {
    lines.push(line)
    notify?.()
  }
  // 응답을 받은 뒤 서버의 close event가 늦게 올 수 있어 줄 수로 완료를 기다린다.
  const waitFor = async (count: number): Promise<void> => {
    while (lines.length < count) {
      await new Promise<void>((resolve) => {
        notify = resolve
      })
    }
  }

  return { lines, sink, waitFor }
}

function readEntry(line: string) {
  const { time, durationMs, correlationId, ...fields } = JSON.parse(line) as Record<string, unknown>
  assert.equal(typeof time, 'string')
  assert(Number.isInteger(durationMs))
  assert.match(correlationId as string, UUID_PATTERN)

  return { correlationId: correlationId as string, fields }
}

// 이름이 stats인 job 하나만 있는 것처럼 답하며 DB를 쓰지 않는다.
const statsOnlyJobs: OpsJobStore = {
  readOverviews: async () => [],
  readRuns: async (name) => {
    if (name === 'stats') {
      return []
    }

    return undefined
  },
  requestRun: async () => ({ status: 'requested', id: 1 }),
  setPaused: async () => 'updated'
}

const unusedCollection = async () => assert.fail('이 테스트는 수집 대기열을 읽으면 안 된다')

const unusedBatchNeopleKeys = async () => assert.fail('이 테스트는 batch key를 다루면 안 된다')
const unusedBatchNeopleKeyStore: OpsBatchNeopleKeyStore = {
  readKeys: unusedBatchNeopleKeys,
  add: unusedBatchNeopleKeys,
  setEnabled: unusedBatchNeopleKeys,
  delete: unusedBatchNeopleKeys
}

function opsApp(options: Partial<OpsHttpAppOptions>) {
  return createOpsHttpApp({
    jobs: statsOnlyJobs,
    readQueueCounts: () => [],
    collection: { readSummary: unusedCollection, requeue: unusedCollection },
    batchNeopleKeys: unusedBatchNeopleKeyStore,
    writeAccessLog: () => undefined,
    ...options
  })
}

async function startOpsApp(t: test.TestContext, options: Partial<OpsHttpAppOptions>) {
  const app = opsApp(options)
  t.after(() => app.close())
  await app.listen(0, '127.0.0.1')
  const origin = await app.getUrl()

  return (path: string, init: RequestInit = {}) => fetch(`${origin}${path}`, init)
}

const json = { 'Content-Type': 'application/json' }

test('운영 app 접근 로그는 요청마다 route template과 allowlist field만 남기고 경로 값, query, body, header는 남기지 않는다', {
  timeout: 5000
}, async (t) => {
  const logs = collectAccessLogs()
  const request = await startOpsApp(t, { writeAccessLog: logs.sink })
  const jobPath = `/api/jobs/${secrets.pathValue}`
  const cases: { path: string; init: RequestInit; expected: Record<string, unknown> }[] = [
    {
      path: `${jobPath}/runs?limit=${secrets.query}`,
      init: {},
      expected: {
        method: 'GET',
        route: '/api/jobs/:name/runs',
        status: 400,
        code: 'INVALID_OPS_REQUEST'
      }
    },
    {
      path: `${jobPath}/runs`,
      init: {
        method: 'POST',
        headers: json,
        body: JSON.stringify({ args: { token: secrets.bodyValue } })
      },
      expected: { method: 'POST', route: '/api/jobs/:name/runs', status: 202 }
    },
    {
      path: `${jobPath}/pause`,
      init: { method: 'POST', headers: json },
      expected: { method: 'POST', route: '/api/jobs/:name/pause', status: 204 }
    },
    {
      path: '/api/jobs/',
      init: { method: 'HEAD' },
      expected: { method: 'HEAD', route: '/api/jobs', status: 200 }
    },
    {
      path: '/api/queues',
      init: {},
      expected: { method: 'GET', route: '/api/queues', status: 200 }
    },
    {
      path: `/accounts/${secrets.pathValue}?access_token=${secrets.query}`,
      init: {},
      expected: { method: 'GET', route: '<unmatched>', status: 404 }
    },
    {
      path: `${jobPath}/runs`,
      init: { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: secrets.bodyValue },
      expected: {
        method: 'POST',
        route: '<unmatched>',
        status: 415,
        code: 'UNSUPPORTED_MEDIA_TYPE'
      }
    }
  ]

  const correlationIds: string[] = []
  for (const { path, init } of cases) {
    const response = await request(path, {
      ...init,
      headers: { ...sensitiveHeaders, ...init.headers }
    })
    await response.arrayBuffer()
    assert.equal(response.headers.get('cache-control'), 'no-store', path)
    correlationIds.push(response.headers.get('x-correlation-id') ?? '')
  }
  await logs.waitFor(cases.length)

  assert.equal(logs.lines.length, cases.length)
  const output = logs.lines.join('\n')
  for (const value of Object.values(secrets)) {
    assert.equal(output.includes(value), false, value)
  }
  const entries = new Map(
    logs.lines.map((line) => {
      const entry = readEntry(line)

      return [entry.correlationId, entry.fields]
    })
  )
  for (const [index, { path, expected }] of cases.entries()) {
    assert.deepEqual(entries.get(correlationIds[index]!), { service: 'api-ops', ...expected }, path)
  }
  assert.equal(new Set(correlationIds).size, cases.length)
})

test('운영 app은 5xx 응답에만 오류 이름과 code를 담은 오류 chain을 남기고, Error가 아닌 값이 던져져도 500으로 답한다', {
  timeout: 5000
}, async (t) => {
  const databaseFailure = Object.assign(new Error(secrets.errorDetail), { code: '57P01' })
  const logs = collectAccessLogs()
  const request = await startOpsApp(t, {
    jobs: {
      ...statsOnlyJobs,
      readOverviews: async () => {
        throw databaseFailure
      },
      requestRun: async () => {
        throw secrets.errorDetail
      }
    },
    writeAccessLog: logs.sink
  })

  const responses = [
    await request('/api/jobs'),
    await request('/api/jobs/stats/runs', { method: 'POST', headers: json, body: '{}' }),
    await request('/api/jobs/missing/runs')
  ]
  const bodies = await Promise.all(responses.map((response) => response.json()))
  await logs.waitFor(3)

  assert.deepEqual(
    responses.map(({ status }) => status),
    [500, 500, 404]
  )
  assert.deepEqual(bodies, [
    { error: { code: 'INTERNAL_SERVER_ERROR' } },
    { error: { code: 'INTERNAL_SERVER_ERROR' } },
    { error: { code: 'JOB_NOT_FOUND' } }
  ])
  assert.equal(logs.lines.join('\n').includes(secrets.errorDetail), false)
  const [thrownError, thrownValue, notFound] = logs.lines.map((line) => {
    const { code, errorChain } = readEntry(line).fields
    const chain = errorChain as { name: string; code?: string; frames?: string[] }[] | undefined

    return { code, chain }
  })
  assert.equal(thrownError!.code, 'INTERNAL_SERVER_ERROR')
  assert.deepEqual(
    thrownError!.chain!.map(({ name, code }) => ({ name, code })),
    [{ name: 'Error', code: '57P01' }]
  )
  assert.match(thrownError!.chain![0]!.frames![0]!, /ops-app\.test\.js:\d+:\d+\)?$/)
  assert.deepEqual(thrownValue, { code: 'INTERNAL_SERVER_ERROR', chain: [{ name: '<non-error>' }] })
  assert.deepEqual(notFound, { code: 'JOB_NOT_FOUND', chain: undefined })
})

test('운영 app은 응답 header를 보내기 전에 연결이 끊긴 요청을 status 없이 aborted로 남긴다', {
  timeout: 5000
}, async (t) => {
  const entered = gate()
  const blocked = gate()
  const logs = collectAccessLogs()
  const request = await startOpsApp(t, {
    jobs: {
      ...statsOnlyJobs,
      readOverviews: async () => {
        entered.release()
        await blocked.promise

        return []
      }
    },
    writeAccessLog: logs.sink
  })
  t.after(() => blocked.release())
  const disconnect = new AbortController()

  const pending = request('/api/jobs', { signal: disconnect.signal }).catch(() => undefined)
  await entered.promise
  disconnect.abort()
  await pending
  await logs.waitFor(1)

  assert.deepEqual(readEntry(logs.lines[0]!).fields, {
    service: 'api-ops',
    method: 'GET',
    route: '/api/jobs',
    aborted: true
  })
})

test('운영 app을 닫으면 진행 중인 요청을 마친 뒤에 DB 연결을 닫는다', {
  timeout: 5000
}, async () => {
  const events: string[] = []
  const entered = gate()
  const blocked = gate()
  const app = opsApp({
    jobs: {
      ...statsOnlyJobs,
      readOverviews: async () => {
        entered.release()
        await blocked.promise
        events.push('요청 처리 끝')

        return []
      }
    },
    close: async () => {
      events.push('DB 연결 닫음')
    }
  })
  await app.listen(0, '127.0.0.1')
  // 응답 뒤에 남은 keep-alive 연결이 닫히기를 기다리지 않도록 요청마다 새 연결을 쓴다.
  const request = get(`${await app.getUrl()}/api/jobs`, { agent: false })
  const responded = once(request, 'response')
  await entered.promise

  const closing = app.close()
  blocked.release()
  const [response] = await responded
  response.resume()
  await closing

  assert.equal(response.statusCode, 200)
  assert.deepEqual(events, ['요청 처리 끝', 'DB 연결 닫음'])
  assert.equal(app.getHttpServer().listening, false)
})

test('listen하지 않은 운영 app도 닫으면 DB 연결을 닫는다', async () => {
  let closeCount = 0
  const app = opsApp({
    close: async () => {
      closeCount += 1
    }
  })

  await app.close()

  assert.equal(closeCount, 1)
})

test('운영 app에는 공개 경로가 없다', async (t) => {
  const request = await startOpsApp(t, {})

  for (const path of ['/health', '/version', '/characters?characterName=fixture', '/today-grade']) {
    const response = await request(path)
    assert.equal(response.status, 404, path)
    assert.deepEqual(await response.json(), { statusCode: 404, message: 'Not Found' })
  }
})

test('잘못된 percent-encoding은 400으로 거절하지 않고, 디코딩하지 않은 값으로 route를 찾아 없는 job이나 없는 경로로 답한다', async (t) => {
  const readNames: string[] = []
  const request = await startOpsApp(t, {
    jobs: {
      ...statsOnlyJobs,
      readRuns: async (name) => {
        readNames.push(name)

        return undefined
      }
    }
  })

  const job = await request('/api/jobs/%E0%A4%A/runs')
  const unmatched = await request('/api/%E0%A4%A')

  assert.deepEqual([job.status, await job.json()], [404, { error: { code: 'JOB_NOT_FOUND' } }])
  assert.deepEqual(readNames, ['%E0%A4%A'])
  assert.deepEqual(
    [unmatched.status, await unmatched.json()],
    [404, { statusCode: 404, message: 'Not Found' }]
  )
})
