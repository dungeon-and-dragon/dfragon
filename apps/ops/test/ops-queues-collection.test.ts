import assert from 'node:assert/strict'
import test from 'node:test'
import type { CollectionSummary } from '@dfragon/database'
import type { BatchNeopleKeyRepository } from '../src/application/batch-neople-keys/repository.js'
import type { CollectionRepository } from '../src/application/collection/repository.js'
import { createOpsHttpApp, type OpsHttpAppOptions } from '../src/runtime/ops-app.js'

const unusedJobs = async () => assert.fail('queue, 수집 대기열 경로 테스트는 job을 읽으면 안 된다')

const unusedBatchNeopleKeys = async () =>
  assert.fail('queue, 수집 대기열 경로 테스트는 batch key를 다루면 안 된다')
const unusedBatchNeopleKeyStore: BatchNeopleKeyRepository = {
  readKeys: unusedBatchNeopleKeys,
  add: unusedBatchNeopleKeys,
  setEnabled: unusedBatchNeopleKeys,
  delete: unusedBatchNeopleKeys
}

async function startOpsApp(
  t: test.TestContext,
  options: Pick<OpsHttpAppOptions, 'readQueueCounts' | 'collection'>
) {
  const app = await createOpsHttpApp({
    jobs: {
      readOverviews: unusedJobs,
      readRuns: unusedJobs,
      requestRun: unusedJobs,
      setPaused: unusedJobs
    },
    batchNeopleKeys: unusedBatchNeopleKeyStore,
    writeAccessLog: () => undefined,
    ...options
  })
  t.after(() => app.close())
  await app.listen(0, '127.0.0.1')
  const origin = await app.getUrl()

  return (path: string, init: RequestInit = {}) => fetch(`${origin}${path}`, init)
}

const unusedCollection: CollectionRepository = {
  readSummary: async () => assert.fail('queue 경로 테스트는 수집 대기열을 읽으면 안 된다'),
  requeue: async () => assert.fail('queue 경로 테스트는 수집 대기열을 바꾸면 안 된다')
}

const summary: CollectionSummary = {
  waiting: 2,
  oldestQueuedAt: new Date('2026-11-09T02:00:00Z'),
  failures: [
    { failure: 'neople-api', count: 2, lastAttemptedAt: new Date('2026-11-09T01:00:00Z') },
    { failure: 'neople-internal', count: 1, lastAttemptedAt: new Date('2026-11-07T01:00:00Z') }
  ]
}

// 집계와 되돌리기 SQL은 컨테이너 검사가 실제 DB로 확인하고, 이 fake는 경로가 받은 failure와 돌려줄 값만 다룬다.
function recordingCollectionStore() {
  const requeued: (string | undefined)[] = []
  const store: CollectionRepository = {
    readSummary: async () => summary,
    requeue: async (failure) => {
      requeued.push(failure)
      if (failure === undefined) {
        return 3
      }

      return 1
    }
  }

  return { store, requeued }
}

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
})

test('운영 queue 경로는 저장된 queue 수를 읽어 주고, 저장된 행이 없으면 빈 목록을 준다', async (t) => {
  const stored = [{ name: 'season-backfill', waiting: 3, running: 1 }]
  let rows: typeof stored = []
  const request = await startOpsApp(t, {
    readQueueCounts: async () => rows,
    collection: unusedCollection
  })

  const empty = await request('/api/queues')
  rows = stored
  const written = await request('/api/queues')

  assert.deepEqual([empty.status, await empty.json()], [200, { queues: [] }])
  assert.deepEqual([written.status, await written.json()], [200, { queues: stored }])
})

test('수집 대기열 현황 경로는 대기 수, 가장 오래된 대기 시각, 실패 종류별 건수와 마지막 시도 시각을 JSON으로 준다', async (t) => {
  const request = await startOpsApp(t, {
    readQueueCounts: () => assert.fail('수집 대기열 경로는 queue를 읽으면 안 된다'),
    collection: recordingCollectionStore().store
  })

  const response = await request('/api/collection')

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    waiting: 2,
    oldestQueuedAt: '2026-11-09T02:00:00.000Z',
    failures: [
      { failure: 'neople-api', count: 2, lastAttemptedAt: '2026-11-09T01:00:00.000Z' },
      { failure: 'neople-internal', count: 1, lastAttemptedAt: '2026-11-07T01:00:00.000Z' }
    ]
  })
})

test('되돌리기 경로는 failure를 주면 그 종류만, 주지 않으면 모든 실패를 되돌리게 하고 되돌린 건수를 준다', async (t) => {
  const { store, requeued } = recordingCollectionStore()
  const request = await startOpsApp(t, {
    readQueueCounts: () => assert.fail('수집 대기열 경로는 queue를 읽으면 안 된다'),
    collection: store
  })

  const internal = await request('/api/collection/requeue', json({ failure: 'neople-internal' }))
  const all = await request('/api/collection/requeue', json({}))

  assert.deepEqual([internal.status, await internal.json()], [200, { requeued: 1 }])
  assert.deepEqual([all.status, await all.json()], [200, { requeued: 3 }])
  assert.deepEqual(requeued, ['neople-internal', undefined])
})

test('되돌리기는 문자열이 아닌 failure와 빈 failure, object가 아닌 본문을 되돌리지 않고 400으로 거절한다', async (t) => {
  const { store, requeued } = recordingCollectionStore()
  const request = await startOpsApp(t, {
    readQueueCounts: () => assert.fail('수집 대기열 경로는 queue를 읽으면 안 된다'),
    collection: store
  })

  for (const body of [{ failure: 1 }, { failure: '' }, { failure: null }, ['neople-api']]) {
    const response = await request('/api/collection/requeue', json(body))
    assert.equal(response.status, 400, JSON.stringify(body))
    assert.deepEqual(await response.json(), { error: { code: 'INVALID_OPS_REQUEST' } })
  }
  assert.deepEqual(requeued, [])
})
