import assert from 'node:assert/strict'
import test from 'node:test'
import type { LabCurrencyIcon, LabCurrencySummary, LabItemGroup } from '@dfragon/database'
import type { BatchNeopleKeyRepository } from '../src/application/batch-neople-keys/repository.js'
import type { LabCurrencyRepository } from '../src/application/lab-currencies/repository.js'
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

// 묶음 교체, 재화 이름 중복, 아이콘 저장은 DB 함수 테스트가 실제 DB로 확인한다. 이 fake는 경로가 넘긴 값만 남긴다.
type StoredCurrency = LabCurrencySummary & { icon: LabCurrencyIcon }

function memoryStore(groups: LabItemGroup[] = [], currencies: StoredCurrency[] = []) {
  const replaced: LabItemGroup[] = []
  const stored = [...currencies]
  const items: LabItemRepository = {
    readGroups: async () => groups,
    replaceGroup: async (group) => {
      replaced.push(group)
    }
  }
  const currencyStore: LabCurrencyRepository = {
    readCurrencies: async () => stored.map(({ id, name, updatedAt }) => ({ id, name, updatedAt })),
    readIcon: async (id) => stored.find((currency) => currency.id === id)?.icon ?? null,
    add: async (name, icon) => {
      if (stored.some((currency) => currency.name === name)) {
        return { status: 'duplicate' }
      }

      const id = stored.length + 1
      stored.push({ id, name, updatedAt: new Date('2026-11-27T00:00:00.000Z'), icon })

      return { status: 'added', id }
    },
    update: async (id, name, icon) => {
      const currency = stored.find((candidate) => candidate.id === id)

      if (currency === undefined) {
        return { status: 'notFound' }
      }

      if (stored.some((candidate) => candidate.name === name && candidate.id !== id)) {
        return { status: 'duplicate' }
      }

      currency.name = name
      currency.icon = icon ?? currency.icon

      return { status: 'updated' }
    }
  }

  return { store: { labItems: items, labCurrencies: currencyStore }, replaced, stored }
}

async function startOpsApp(
  t: test.TestContext,
  { labItems, labCurrencies }: { labItems: LabItemRepository; labCurrencies: LabCurrencyRepository }
) {
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
    labCurrencies,
    writeAccessLog: () => undefined
  })
  t.after(() => app.close())
  await app.listen(0, '127.0.0.1')
  const origin = await app.getUrl()

  return (path: string, init: RequestInit = {}) => fetch(`${origin}/api/${path}`, init)
}

function jsonRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }
}

// 합성 그림이다. 형식 판정에 쓰는 앞부분만 실제 형식과 같다.
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01])
const WEBP_BYTES = new Uint8Array([...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBPVP8 ')])
const base64Of = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64')

const coin = {
  id: 1,
  name: '합성 재화',
  updatedAt: new Date('2026-11-26T00:00:00.000Z'),
  icon: { bytes: PNG_BYTES, contentType: 'image/png' }
}

test('고른 아이템을 재화 비용과 함께 묶음별로 응답한다', async (t) => {
  const groups = [
    {
      category: 'TITLE',
      role: 'all',
      tier: '종결',
      items: [
        { itemName: '합성 칭호 A', cost: null },
        { itemName: '합성 칭호 B', cost: { currencyId: 1, count: 5 } }
      ]
    }
  ]
  const { store } = memoryStore(groups)
  const request = await startOpsApp(t, store)

  const response = await request('lab-items')

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { groups })
})

test('묶음의 아이템을 이름 앞뒤 공백을 지우고 비용과 함께 넘기고 204로 답하며, 빈 목록도 넘긴다', async (t) => {
  const { store, replaced } = memoryStore([], [coin])
  const request = await startOpsApp(t, store)
  const bodies = [
    {
      category: 'WEAPON',
      role: 'buffer',
      tier: '종결',
      items: [
        { itemName: ' 합성 카드 A ', cost: null },
        { itemName: '합성 보주', cost: { currencyId: 1, count: 5 } }
      ]
    },
    { category: 'AURA', role: 'all', tier: '준종결', items: [] }
  ]

  for (const body of bodies) {
    const response = await request('lab-items', jsonRequest('PUT', body))
    assert.equal(response.status, 204, JSON.stringify(body))
  }

  assert.deepEqual(replaced, [
    {
      category: 'WEAPON',
      role: 'buffer',
      tier: '종결',
      items: [
        { itemName: '합성 카드 A', cost: null },
        { itemName: '합성 보주', cost: { currencyId: 1, count: 5 } }
      ]
    },
    { category: 'AURA', role: 'all', tier: '준종결', items: [] }
  ])
})

test('정해지지 않은 종류, 역할, 등급, 종류와 맞지 않는 역할, 빈 이름, 겹친 이름, 잘못된 비용은 400으로 거절하고 넘기지 않는다', async (t) => {
  const { store, replaced } = memoryStore([], [coin])
  const request = await startOpsApp(t, store)
  const item = { itemName: '합성 칭호 A', cost: null }
  const valid = { category: 'TITLE', role: 'all', tier: '종결', items: [item] }
  const bodies = [
    { ...valid, category: 'HAT' },
    { ...valid, role: 'tank' },
    { ...valid, tier: '중결' },
    { ...valid, role: 'dealer' },
    { ...valid, category: 'RING', role: 'all' },
    { ...valid, items: [item, { itemName: '   ', cost: null }] },
    { ...valid, items: [item, { itemName: ' 합성 칭호 A', cost: null }] },
    { ...valid, items: [{ itemName: '합성 칭호 A' }] },
    { ...valid, items: [{ ...item, cost: { currencyId: 1, count: 0 } }] },
    { ...valid, items: [{ ...item, cost: { currencyId: 1, count: 1.5 } }] },
    { ...valid, items: [{ ...item, cost: { currencyId: 1, count: 2_147_483_648 } }] },
    { ...valid, items: [{ ...item, cost: { currencyId: 1 } }] },
    { category: 'TITLE', role: 'all', tier: '종결', itemNames: ['합성 칭호 A'] },
    { category: 'TITLE', role: 'all', tier: '종결' }
  ]

  for (const body of bodies) {
    const response = await request('lab-items', jsonRequest('PUT', body))
    assert.equal(response.status, 400, JSON.stringify(body))
    assert.deepEqual(await response.json(), { error: { code: 'INVALID_OPS_REQUEST' } })
  }

  assert.deepEqual(replaced, [])
})

test('등록되지 않은 재화로 비용을 붙이면 404로 거절하고 넘기지 않는다', async (t) => {
  const { store, replaced } = memoryStore([], [coin])
  const request = await startOpsApp(t, store)

  const response = await request(
    'lab-items',
    jsonRequest('PUT', {
      category: 'TITLE',
      role: 'all',
      tier: '종결',
      items: [{ itemName: '합성 칭호 A', cost: { currencyId: 2, count: 1 } }]
    })
  )

  assert.equal(response.status, 404)
  assert.deepEqual(await response.json(), { error: { code: 'LAB_CURRENCY_NOT_FOUND' } })
  assert.deepEqual(replaced, [])
})

test('재화를 등록하면 파일 앞부분으로 정한 형식으로 아이콘을 저장하고, 목록과 아이콘 경로로 돌려준다', async (t) => {
  const { store, stored } = memoryStore()
  const request = await startOpsApp(t, store)

  const added = await request(
    'lab-currencies',
    jsonRequest('POST', { name: ' 합성 재화 ', icon: base64Of(WEBP_BYTES) })
  )

  assert.equal(added.status, 201)
  assert.deepEqual(await added.json(), { id: 1 })
  assert.deepEqual(stored[0]?.icon, { bytes: WEBP_BYTES, contentType: 'image/webp' })

  const list = await request('lab-currencies')
  assert.deepEqual(await list.json(), {
    currencies: [{ id: 1, name: '합성 재화', updatedAt: '2026-11-27T00:00:00.000Z' }]
  })

  const icon = await request('lab-currencies/1/icon')
  assert.equal(icon.status, 200)
  assert.equal(icon.headers.get('content-type'), 'image/webp')
  assert.equal(icon.headers.get('x-content-type-options'), 'nosniff')
  assert.deepEqual(new Uint8Array(await icon.arrayBuffer()), WEBP_BYTES)
  assert.equal((await request('lab-currencies/2/icon')).status, 404)
})

test('PNG, JPEG, GIF, WebP 아이콘은 올린 쪽이 밝힌 형식과 상관없이 파일 앞부분의 형식으로 저장한다', async (t) => {
  const { store, stored } = memoryStore()
  const request = await startOpsApp(t, store)
  const icons = [
    { bytes: PNG_BYTES, contentType: 'image/png' },
    { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]), contentType: 'image/jpeg' },
    { bytes: new Uint8Array([...Buffer.from('GIF89a'), 0x01]), contentType: 'image/gif' },
    { bytes: WEBP_BYTES, contentType: 'image/webp' }
  ]

  for (const [index, { bytes }] of icons.entries()) {
    const response = await request(
      'lab-currencies',
      jsonRequest('POST', {
        name: `합성 재화 ${index}`,
        icon: base64Of(bytes),
        contentType: 'image/svg+xml'
      })
    )
    assert.equal(response.status, 201)
  }

  assert.deepEqual(
    stored.map(({ icon }) => icon),
    icons
  )
})

test('재화를 고치면 아이콘 없이는 이름만 바꾸고, 겹친 이름은 409, 없는 재화는 404로 답한다', async (t) => {
  const { store, stored } = memoryStore([], [coin, { ...coin, id: 2, name: '합성 재화 B' }])
  const request = await startOpsApp(t, store)

  const renamed = await request('lab-currencies/1', jsonRequest('PUT', { name: '바뀐 재화' }))
  assert.equal(renamed.status, 204)
  assert.deepEqual(stored[0]?.icon, coin.icon)
  assert.equal(stored[0]?.name, '바뀐 재화')

  const reiconed = await request(
    'lab-currencies/1',
    jsonRequest('PUT', { name: '바뀐 재화', icon: base64Of(WEBP_BYTES) })
  )
  assert.equal(reiconed.status, 204)
  assert.deepEqual(stored[0]?.icon, { bytes: WEBP_BYTES, contentType: 'image/webp' })

  const duplicate = await request('lab-currencies/2', jsonRequest('PUT', { name: '바뀐 재화' }))
  assert.equal(duplicate.status, 409)
  assert.deepEqual(await duplicate.json(), { error: { code: 'LAB_CURRENCY_DUPLICATE' } })

  const missing = await request('lab-currencies/9', jsonRequest('PUT', { name: '합성 재화 C' }))
  assert.equal(missing.status, 404)

  const addedDuplicate = await request(
    'lab-currencies',
    jsonRequest('POST', { name: '바뀐 재화', icon: base64Of(PNG_BYTES) })
  )
  assert.equal(addedDuplicate.status, 409)
})

test('그림이 아니거나 64KiB를 넘는 아이콘, 빈 이름, 잘못된 id는 400으로 거절하고 저장하지 않는다', async (t) => {
  const { store, stored } = memoryStore()
  const request = await startOpsApp(t, store)
  const oversized = new Uint8Array(64 * 1024 + 1)
  oversized.set(PNG_BYTES)
  const bodies = [
    { name: '합성 재화', icon: base64Of(new Uint8Array([0x3c, 0x73, 0x76, 0x67])) },
    { name: '합성 재화', icon: base64Of(oversized) },
    { name: '합성 재화', icon: '' },
    { name: '합성 재화', icon: 'not base64!' },
    { name: '  ', icon: base64Of(PNG_BYTES) },
    { name: '합성 재화' }
  ]

  for (const body of bodies) {
    const response = await request('lab-currencies', jsonRequest('POST', body))
    assert.equal(response.status, 400, JSON.stringify(body).slice(0, 80))
  }

  assert.equal(
    (await request('lab-currencies/0', jsonRequest('PUT', { name: '합성 재화' }))).status,
    400
  )
  assert.equal((await request('lab-currencies/abc/icon')).status, 400)
  assert.deepEqual(stored, [])
})

test('재화 경로만 아이콘을 담을 큰 본문을 받고, 다른 경로는 16KiB 상한을 그대로 둔다', async (t) => {
  const { store, replaced } = memoryStore()
  const request = await startOpsApp(t, store)
  const icon = new Uint8Array(48 * 1024)
  icon.set(PNG_BYTES)
  const longName = '가'.repeat(8 * 1024)

  const added = await request(
    'lab-currencies',
    jsonRequest('POST', { name: '합성 재화', icon: base64Of(icon) })
  )
  const items = await request(
    'lab-items',
    jsonRequest('PUT', {
      category: 'AURA',
      role: 'all',
      tier: '종결',
      items: [{ itemName: longName, cost: null }]
    })
  )

  assert.equal(added.status, 201)
  assert.equal(items.status, 400)
  assert.deepEqual(replaced, [])
})
