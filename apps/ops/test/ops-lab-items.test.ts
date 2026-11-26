import assert from 'node:assert/strict'
import test from 'node:test'
import type { LabItemGroup } from '@dfragon/database'
import type { BatchNeopleKeyRepository } from '../src/application/batch-neople-keys/repository.js'
import type { LabItemRepository } from '../src/application/lab-items/repository.js'
import { createOpsHttpApp } from '../src/runtime/ops-app.js'

const unusedJobs = async () => assert.fail('실험실 아이템 경로 테스트는 job을 다루면 안 된다')
const unusedCollection = async () =>
  assert.fail('실험실 아이템 경로 테스트는 수집 대기열을 다루면 안 된다')
const unusedBatchNeopleKeys = async () =>
  assert.fail('실험실 아이템 경로 테스트는 batch key를 다루면 안 된다')
const unusedBatchNeopleKeyStore: BatchNeopleKeyRepository = {
  readKeys: unusedBatchNeopleKeys,
  add: unusedBatchNeopleKeys,
  setEnabled: unusedBatchNeopleKeys,
  delete: unusedBatchNeopleKeys
}

// 묶음 교체와 다른 묶음 보존은 DB 함수 테스트가 실제 DB로 확인한다. 이 fake는 경로가 넘긴 값만 남긴다.
function memoryStore(groups: LabItemGroup[] = []) {
  const replaced: LabItemGroup[] = []
  const store: LabItemRepository = {
    readGroups: async () => groups,
    replaceGroup: async (group) => {
      replaced.push(group)
    }
  }

  return { store, replaced }
}

async function startOpsApp(t: test.TestContext, labItems: LabItemRepository) {
  const app = await createOpsHttpApp({
    jobs: {
      readOverviews: unusedJobs,
      readRuns: unusedJobs,
      requestRun: unusedJobs,
      setPaused: unusedJobs
    },
    readQueueCounts: () => assert.fail('실험실 아이템 경로 테스트는 queue를 읽으면 안 된다'),
    collection: { readSummary: unusedCollection, requeue: unusedCollection },
    batchNeopleKeys: unusedBatchNeopleKeyStore,
    labItems,
    writeAccessLog: () => undefined
  })
  t.after(() => app.close())
  await app.listen(0, '127.0.0.1')
  const origin = await app.getUrl()

  return (init: RequestInit = {}) => fetch(`${origin}/api/lab-items`, init)
}

function putRequest(body: unknown): RequestInit {
  return {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }
}

test('고른 아이템을 묶음별로 응답한다', async (t) => {
  const groups = [
    { category: 'TITLE', role: 'all', tier: '종결', itemNames: ['합성 칭호 A', '합성 칭호 B'] },
    { category: 'WEAPON', role: 'dealer', tier: '준종결', itemNames: ['합성 카드 A'] }
  ]
  const { store } = memoryStore(groups)
  const request = await startOpsApp(t, store)

  const response = await request()

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { groups })
})

test('묶음의 이름 목록을 앞뒤 공백을 지워 넘기고 204로 답하며, 빈 목록도 넘긴다', async (t) => {
  const { store, replaced } = memoryStore()
  const request = await startOpsApp(t, store)
  const bodies = [
    {
      category: 'WEAPON',
      role: 'buffer',
      tier: '종결',
      itemNames: [' 합성 카드 A ', '합성 카드 B']
    },
    { category: 'AURA', role: 'all', tier: '준종결', itemNames: [] }
  ]

  for (const body of bodies) {
    const response = await request(putRequest(body))
    assert.equal(response.status, 204, JSON.stringify(body))
  }

  assert.deepEqual(replaced, [
    { category: 'WEAPON', role: 'buffer', tier: '종결', itemNames: ['합성 카드 A', '합성 카드 B'] },
    { category: 'AURA', role: 'all', tier: '준종결', itemNames: [] }
  ])
})

test('정해지지 않은 종류, 역할, 등급, 종류와 맞지 않는 역할, 빈 이름, 겹친 이름은 400으로 거절하고 넘기지 않는다', async (t) => {
  const { store, replaced } = memoryStore()
  const request = await startOpsApp(t, store)
  const valid = { category: 'TITLE', role: 'all', tier: '종결', itemNames: ['합성 칭호 A'] }
  const bodies = [
    { ...valid, category: 'HAT' },
    { ...valid, role: 'tank' },
    { ...valid, tier: '중결' },
    { ...valid, role: 'dealer' },
    { ...valid, category: 'RING', role: 'all' },
    { ...valid, itemNames: ['합성 칭호 A', '   '] },
    { ...valid, itemNames: ['합성 칭호 A', ' 합성 칭호 A'] },
    { ...valid, itemNames: '합성 칭호 A' },
    { category: 'TITLE', role: 'all', tier: '종결' }
  ]

  for (const body of bodies) {
    const response = await request(putRequest(body))
    assert.equal(response.status, 400, JSON.stringify(body))
    assert.deepEqual(await response.json(), { error: { code: 'INVALID_OPS_REQUEST' } })
  }

  assert.deepEqual(replaced, [])
})
