import assert from 'node:assert/strict'
import test from 'node:test'
import type { BatchNeopleKeySummary } from '@dfragon/database'
import type { BatchNeopleKeyRepository } from '../src/application/batch-neople-keys/repository.js'
import { createOpsHttpApp } from '../src/runtime/ops-app.js'

// 합성 key다. 실제 Neople key가 아니다.
const KEY = 'synthetic-batch-key-7f3a'
const KEY_SUFFIX = '7f3a'

const unusedJobs = async () => assert.fail('batch key 경로 테스트는 job을 다루면 안 된다')
const unusedCollection = async () =>
  assert.fail('batch key 경로 테스트는 수집 대기열을 다루면 안 된다')

// 중복, 끝 4자 자르기, 켜고 끄기는 DB 함수 테스트가 실제 DB로 확인한다. 이 fake는 경로가 받은 값과 돌려줄 결과만 다룬다.
function memoryStore() {
  const added: { label: string; key: string }[] = []
  const rows = new Map<number, BatchNeopleKeySummary & { key: string }>()
  const store: BatchNeopleKeyRepository = {
    // 원문을 담은 행을 그대로 돌려줘 경로가 응답 field를 고르는지 확인한다.
    readKeys: async () => [...rows.values()],
    add: async (input) => {
      added.push(input)

      if ([...rows.values()].some(({ key }) => key === input.key)) {
        return { status: 'duplicate' }
      }

      const id = rows.size + 1
      const keySuffix = input.key.slice(-4)
      const createdAt = new Date('2026-11-12T00:00:00Z')
      rows.set(id, {
        id,
        label: input.label,
        key: input.key,
        keySuffix,
        enabled: true,
        createdAt,
        rejectedAt: null
      })

      return { status: 'added', id }
    },
    setEnabled: async (id, enabled) => {
      const row = rows.get(id)

      if (row === undefined) {
        return false
      }

      row.enabled = enabled

      return true
    },
    delete: async (id) => rows.delete(id)
  }

  return { store, added }
}

async function startOpsApp(
  t: test.TestContext,
  batchNeopleKeys: BatchNeopleKeyRepository,
  logs: string[] = []
) {
  const app = await createOpsHttpApp({
    jobs: {
      readOverviews: unusedJobs,
      readRuns: unusedJobs,
      requestRun: unusedJobs,
      setPaused: unusedJobs
    },
    readQueueCounts: () => assert.fail('batch key 경로 테스트는 queue를 읽으면 안 된다'),
    collection: { readSummary: unusedCollection, requeue: unusedCollection },
    batchNeopleKeys,
    writeAccessLog: (line) => logs.push(line)
  })
  t.after(() => app.close())
  await app.listen(0, '127.0.0.1')
  const origin = await app.getUrl()

  return (path: string, init: RequestInit = {}) => fetch(`${origin}${path}`, init)
}

function jsonRequest(method: string, body?: unknown): RequestInit {
  const text = body === undefined ? undefined : JSON.stringify(body)

  return { method, headers: { 'Content-Type': 'application/json' }, body: text }
}

test('추가한 key는 목록에서 끝 4자만 보이고, 같은 key를 다시 추가하면 409로 답한다', async (t) => {
  const { store, added } = memoryStore()
  const request = await startOpsApp(t, store)

  const created = await request(
    '/api/batch-neople-keys',
    jsonRequest('POST', { label: ' 첫 key ', key: ` ${KEY}\n` })
  )
  assert.equal(created.status, 201)
  assert.deepEqual(await created.json(), { id: 1 })
  assert.deepEqual(added, [{ label: '첫 key', key: KEY }])

  const duplicate = await request(
    '/api/batch-neople-keys',
    jsonRequest('POST', { label: '다른 이름', key: KEY })
  )
  assert.equal(duplicate.status, 409)
  assert.deepEqual(await duplicate.json(), { error: { code: 'BATCH_NEOPLE_KEY_DUPLICATE' } })

  const listed = await request('/api/batch-neople-keys')
  assert.equal(listed.status, 200)
  const text = await listed.text()
  assert.equal(text.includes(KEY), false)
  assert.deepEqual(JSON.parse(text), {
    keys: [
      {
        id: 1,
        label: '첫 key',
        keySuffix: KEY_SUFFIX,
        enabled: true,
        createdAt: '2026-11-12T00:00:00.000Z',
        rejectedAt: null
      }
    ]
  })
})

test('이름이나 key가 비었거나 공백뿐이면 저장하지 않고 400으로 답한다', async (t) => {
  const { store, added } = memoryStore()
  const request = await startOpsApp(t, store)
  const bodies = [
    { label: '이름', key: '' },
    { label: '이름', key: ' \t\n' },
    { label: '', key: KEY },
    { label: '   ', key: KEY },
    { label: '이름' },
    { label: '이름', key: 1234 }
  ]

  for (const body of bodies) {
    const response = await request('/api/batch-neople-keys', jsonRequest('POST', body))
    assert.equal(response.status, 400, JSON.stringify(body))
    assert.deepEqual(await response.json(), { error: { code: 'INVALID_OPS_REQUEST' } })
  }

  assert.deepEqual(added, [])
})

test('켜기, 끄기, 삭제는 204로 답하고, 없는 id는 404, 숫자가 아닌 id는 400으로 답한다', async (t) => {
  const { store } = memoryStore()
  const request = await startOpsApp(t, store)
  await request('/api/batch-neople-keys', jsonRequest('POST', { label: '이름', key: KEY }))

  const disableResponse = await request('/api/batch-neople-keys/1/disable', jsonRequest('POST'))
  assert.equal(disableResponse.status, 204)
  const disabled = (await (await request('/api/batch-neople-keys')).json()) as {
    keys: { enabled: boolean }[]
  }

  assert.deepEqual(
    disabled.keys.map(({ enabled }) => enabled),
    [false]
  )
  const enableResponse = await request('/api/batch-neople-keys/1/enable', jsonRequest('POST'))
  assert.equal(enableResponse.status, 204)
  const reenabled = (await (await request('/api/batch-neople-keys')).json()) as {
    keys: { enabled: boolean }[]
  }

  assert.deepEqual(
    reenabled.keys.map(({ enabled }) => enabled),
    [true]
  )
  const deleteResponse = await request('/api/batch-neople-keys/1', jsonRequest('DELETE'))
  assert.equal(deleteResponse.status, 204)
  assert.deepEqual(await (await request('/api/batch-neople-keys')).json(), { keys: [] })

  for (const [path, method] of [
    ['/api/batch-neople-keys/1', 'DELETE'],
    ['/api/batch-neople-keys/1/enable', 'POST'],
    ['/api/batch-neople-keys/2/disable', 'POST']
  ] as const) {
    const response = await request(path, jsonRequest(method))
    assert.equal(response.status, 404, `${method} ${path}`)
    assert.deepEqual(await response.json(), { error: { code: 'BATCH_NEOPLE_KEY_NOT_FOUND' } })
  }

  for (const id of ['0', 'abc', '1234567890']) {
    const response = await request(`/api/batch-neople-keys/${id}`, jsonRequest('DELETE'))
    assert.equal(response.status, 400, id)
  }
})

test('JSON이 아닌 요청은 415, 본문 한도를 넘는 요청은 400으로 거절하고 저장하지 않는다', async (t) => {
  const { store, added } = memoryStore()
  const request = await startOpsApp(t, store)

  const form = await request('/api/batch-neople-keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `label=x&key=${KEY}`
  })
  assert.equal(form.status, 415)
  assert.equal((await request('/api/batch-neople-keys/1', { method: 'DELETE' })).status, 415)
  const oversizedKey = 'k'.repeat(17 * 1024)
  const oversized = await request(
    '/api/batch-neople-keys',
    jsonRequest('POST', { label: '이름', key: oversizedKey })
  )
  assert.equal(oversized.status, 400)
  assert.deepEqual(added, [])
})

test('접근 로그에는 추가 요청이 실패해도 key 원문이 남지 않는다', async (t) => {
  const logs: string[] = []
  const { store } = memoryStore()
  const failing: BatchNeopleKeyRepository = {
    ...store,
    add: async ({ key }) => {
      throw new Error(`duplicate key value (key)=(${key})`)
    }
  }

  const request = await startOpsApp(t, failing, logs)

  const response = await request(
    '/api/batch-neople-keys',
    jsonRequest('POST', { label: '이름', key: KEY })
  )
  assert.equal(response.status, 500)
  assert.equal((await response.text()).includes(KEY), false)

  // 응답을 받은 뒤 접근 로그가 늦게 쓰일 수 있어 몇 turn만 기다린다.
  for (let turn = 0; turn < 100 && logs.length === 0; turn++) {
    await new Promise((resolve) => setImmediate(resolve))
  }

  assert.equal(logs.length, 1)
  assert.equal(logs.join('\n').includes(KEY), false)
  assert.equal(JSON.parse(logs[0]!).route, '/api/batch-neople-keys')
})
