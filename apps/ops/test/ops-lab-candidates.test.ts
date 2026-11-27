import assert from 'node:assert/strict'
import test from 'node:test'
import type {
  AuctionPriceHistoryEntry,
  LabCandidateBatch,
  LabCandidateInput,
  LabCandidateQuery,
  LabCandidateSummary,
  LabCurrencyIcon
} from '@dfragon/database'
import type { LabCandidateRepository } from '../src/application/lab-candidates/repository.js'
import { createOpsHttpApp } from '../src/runtime/ops-app.js'

const unused = async () => assert.fail('실험실 후보 경로 테스트는 다른 저장소를 다루면 안 된다')

// 판마다 줄을 지우는 규칙과 가격 join은 DB 함수 테스트가 실제 DB로 확인한다. 이 fake는 이름과 판 id만 따른다.
function memoryStore(candidates: LabCandidateSummary[] = []) {
  const batches: LabCandidateBatch[] = []
  const queries: LabCandidateQuery[] = []
  const versions = new Map<string, string>()
  const icons = new Map<string, LabCurrencyIcon>()
  const history = new Map<string, AuctionPriceHistoryEntry[]>()
  const store: LabCandidateRepository = {
    upsert: async (batch) => {
      batches.push(batch)

      for (const { itemName } of batch.items) {
        versions.set(itemName, batch.versionId)
      }
    },
    saveIcon: async (itemName, icon) => {
      if (!versions.has(itemName)) {
        return { status: 'notFound' }
      }

      icons.set(itemName, icon)

      return { status: 'updated' }
    },
    deleteOtherVersions: async (versionId) => {
      const names = [...versions.keys()]
      const remaining = names.filter((name) => versions.get(name) === versionId).length

      if (remaining === 0) {
        return { remaining, deleted: 0 }
      }

      const others = names.filter((name) => versions.get(name) !== versionId)

      for (const name of others) {
        versions.delete(name)
      }

      return { remaining, deleted: others.length }
    },
    readCandidates: async (query) => {
      queries.push(query)

      return candidates
    },
    readIcon: async (itemName) => icons.get(itemName) ?? null,
    readPriceHistory: async (itemName) => history.get(itemName) ?? []
  }

  return { store, batches, queries, versions, icons, history }
}

async function startOpsApp(t: test.TestContext, labCandidates: LabCandidateRepository) {
  const app = await createOpsHttpApp({
    jobs: { readOverviews: unused, readRuns: unused, requestRun: unused, setPaused: unused },
    readQueueCounts: unused,
    collection: { readSummary: unused, requeue: unused },
    batchNeopleKeys: { readKeys: unused, add: unused, setEnabled: unused, delete: unused },
    labItems: { readGroups: unused, replaceGroup: unused },
    labCurrencies: { readCurrencies: unused, readIcon: unused, add: unused, update: unused },
    labItemDetails: { readDetails: unused, readIcon: unused, save: unused },
    labCandidates,
    writeAccessLog: () => undefined
  })
  t.after(() => app.close())
  await app.listen(0, '127.0.0.1')
  const origin = await app.getUrl()

  return (path: string, init: RequestInit = {}) =>
    fetch(`${origin}/api/lab-candidates${path}`, init)
}

function jsonRequest(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

// 합성 그림이다. 형식 판정에 쓰는 앞부분만 실제 형식과 같다.
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01])
const base64Of = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64')

// 지어낸 후보다. 데이터 묶음의 실제 이름과 옵션이 아니다.
const title = {
  itemName: '합성 칭호',
  kind: 'TITLE',
  categories: ['TITLE'],
  roles: ['all'],
  itemRarity: '레전더리',
  fame: 300,
  availableLevel: 1,
  itemTypeDetail: '칭호',
  options: [{ name: '힘', value: '50' }],
  buffLines: ['합성 버프 줄'],
  card: null,
  description: '합성 설명',
  sourceItemId: 'synthetic-title'
} satisfies LabCandidateInput
const enchantCard = {
  ...title,
  itemName: '합성 카드',
  kind: 'ENCHANT',
  categories: ['JACKET', 'PANTS'],
  roles: ['dealer'],
  itemTypeDetail: '마법부여',
  card: {
    slots: ['상의', '하의'],
    enchants: [{ upgrade: 0, status: [{ name: '힘', value: '90' }] }]
  },
  sourceItemId: 'synthetic-card'
}

function candidate(overrides: Partial<LabCandidateSummary>): LabCandidateSummary {
  return {
    ...title,
    versionId: 'synthetic-v1',
    importedAt: new Date('2026-11-28T00:00:00.000Z'),
    hasIcon: false,
    iconUpdatedAt: null,
    itemId: 'synthetic-id',
    unitPrice: 1000,
    checkedAt: new Date('2026-11-28T01:00:00.000Z'),
    previousPrice: null,
    wearCount: null,
    wearCountedAt: null,
    ...overrides
  }
}

test('batch는 후보 이름의 앞뒤 공백을 잘라 판 id와 함께 넘기고 204로 답한다', async (t) => {
  const { store, batches } = memoryStore()
  const request = await startOpsApp(t, store)

  const response = await request(
    '/batch',
    jsonRequest('PUT', {
      snapshotId: 'synthetic-v1',
      items: [{ ...title, itemName: ' 합성 칭호 ' }, enchantCard]
    })
  )

  assert.equal(response.status, 204)
  assert.equal(batches.length, 1)
  assert.equal(batches[0].versionId, 'synthetic-v1')
  assert.deepEqual(
    batches[0].items.map(({ itemName }) => itemName),
    ['합성 칭호', '합성 카드']
  )
  assert.deepEqual(batches[0].items[1], enchantCard)
})

test('batch는 종류와 종류 목록, 역할 목록이 맞지 않거나 값이 범위를 벗어나면 400으로 거절하고 저장하지 않는다', async (t) => {
  const { store, batches } = memoryStore()
  const request = await startOpsApp(t, store)
  const invalidItems = {
    '마법부여 카드의 역할 all': { ...enchantCard, roles: ['all'] },
    '칭호의 부여 부위': { ...title, categories: ['JACKET'] },
    '칭호의 딜러 역할': { ...title, roles: ['dealer'] },
    '크리쳐 종류에 칭호 목록': { ...title, kind: 'CREATURE' },
    '마법부여 카드의 빈 부위': { ...enchantCard, categories: [] },
    '마법부여 카드의 중복 부위': { ...enchantCard, categories: ['JACKET', 'JACKET'] },
    '마법부여 카드의 빈 역할': { ...enchantCard, roles: [] },
    '목록에 없는 등급': { ...title, itemRarity: '전설' },
    '0인 명성': { ...title, fame: 0 },
    '0인 레벨제한': { ...title, availableLevel: 0 },
    '31개 옵션': {
      ...title,
      options: Array.from({ length: 31 }, (_, index) => ({ name: `옵션${index}`, value: '1' }))
    },
    '빈 이름': { ...title, itemName: ' ' },
    '빈 원본 아이템 id': { ...title, sourceItemId: '' }
  }

  for (const [name, item] of Object.entries(invalidItems)) {
    const response = await request(
      '/batch',
      jsonRequest('PUT', { snapshotId: 'synthetic-v1', items: [item] })
    )

    assert.equal(response.status, 400, name)
  }

  const invalidBodies = {
    '공백을 자르면 같은 이름': {
      snapshotId: 'v1',
      items: [title, { ...title, itemName: '합성 칭호 ' }]
    },
    '빈 묶음': { snapshotId: 'v1', items: [] },
    '51개 묶음': {
      snapshotId: 'v1',
      items: Array.from({ length: 51 }, (_, index) => ({ ...title, itemName: `합성 ${index}` }))
    },
    '빈 판 id': { snapshotId: ' ', items: [title] }
  }

  for (const [name, body] of Object.entries(invalidBodies)) {
    const response = await request('/batch', jsonRequest('PUT', body))
    assert.equal(response.status, 400, name)
  }

  assert.deepEqual(batches, [])
})

test('batch는 16KiB를 넘는 본문을 거절하고, icon은 48KiB PNG를 저장한다', async (t) => {
  const { store, batches, icons } = memoryStore()
  const request = await startOpsApp(t, store)
  const longDescriptions = Array.from({ length: 40 }, (_, index) => ({
    ...title,
    itemName: `합성 ${index}`,
    description: '가'.repeat(500)
  }))
  const icon = new Uint8Array(48 * 1024)
  icon.set(PNG_BYTES)

  const batch = await request(
    '/batch',
    jsonRequest('PUT', { snapshotId: 'synthetic-v1', items: longDescriptions })
  )
  await request('/batch', jsonRequest('PUT', { snapshotId: 'synthetic-v1', items: [title] }))
  const saved = await request(
    '/icon',
    jsonRequest('PUT', { itemName: '합성 칭호', icon: base64Of(icon) })
  )
  const read = await request(`/icon?itemName=${encodeURIComponent('합성 칭호')}`)

  assert.equal(batch.status, 400)
  assert.equal(batches.length, 1)
  assert.equal(saved.status, 204)
  assert.deepEqual(icons.get('합성 칭호'), { bytes: icon, contentType: 'image/png' })
  assert.equal(read.status, 200)
  assert.equal(read.headers.get('content-type'), 'image/png')
  assert.equal(read.headers.get('cache-control'), 'no-store')
  assert.equal(read.headers.get('x-content-type-options'), 'nosniff')
  assert.deepEqual(new Uint8Array(await read.arrayBuffer()), icon)
})

test('icon은 후보에 없는 이름이면 404, 그림이 아니면 400이고, 아이콘이 없는 이름은 읽을 때 404다', async (t) => {
  const { store, icons } = memoryStore()
  const request = await startOpsApp(t, store)
  await request('/batch', jsonRequest('PUT', { snapshotId: 'synthetic-v1', items: [title] }))

  const missing = await request(
    '/icon',
    jsonRequest('PUT', { itemName: '없는 합성 칭호', icon: base64Of(PNG_BYTES) })
  )
  const notImage = await request(
    '/icon',
    jsonRequest('PUT', {
      itemName: '합성 칭호',
      icon: base64Of(new Uint8Array([0x3c, 0x73, 0x76, 0x67]))
    })
  )
  const unsetIcon = await request(`/icon?itemName=${encodeURIComponent('합성 칭호')}`)

  assert.equal(missing.status, 404)
  assert.deepEqual(await missing.json(), { error: { code: 'LAB_CANDIDATE_NOT_FOUND' } })
  assert.equal(notImage.status, 400)
  assert.equal(icons.size, 0)
  assert.equal(unsetIcon.status, 404)
  assert.equal((await request('/icon')).status, 400)
})

test('finish는 다른 판의 줄을 지워 남긴 수와 지운 수를 내고, 줄이 없는 판이면 404로 답하고 지우지 않는다', async (t) => {
  const { store, versions } = memoryStore()
  const request = await startOpsApp(t, store)
  await request('/batch', jsonRequest('PUT', { snapshotId: 'synthetic-v1', items: [title] }))
  await request('/batch', jsonRequest('PUT', { snapshotId: 'synthetic-v2', items: [enchantCard] }))

  const unknown = await request('/finish', jsonRequest('POST', { snapshotId: 'synthetic-v3' }))

  assert.equal(unknown.status, 404)
  assert.deepEqual(await unknown.json(), { error: { code: 'LAB_CANDIDATE_SNAPSHOT_NOT_FOUND' } })
  assert.equal(versions.size, 2)

  const finished = await request('/finish', jsonRequest('POST', { snapshotId: 'synthetic-v2' }))

  assert.equal(finished.status, 200)
  assert.deepEqual(await finished.json(), { kept: 1, pruned: 1 })
  assert.deepEqual([...versions.keys()], ['합성 카드'])
})

test('조회는 kind가 없거나 ENCHANT에 부위나 역할이 없으면 400이고, 맞는 query만 저장소에 넘긴다', async (t) => {
  const { store, queries } = memoryStore()
  const request = await startOpsApp(t, store)
  const invalidQueries = [
    '',
    '?kind=WEAPON',
    '?kind=ENCHANT',
    '?kind=ENCHANT&category=JACKET',
    '?kind=ENCHANT&role=dealer',
    '?kind=ENCHANT&category=TITLE&role=dealer',
    '?kind=ENCHANT&category=JACKET&role=all',
    '?kind=TITLE&category=JACKET'
  ]

  for (const query of invalidQueries) {
    assert.equal((await request(query)).status, 400, query)
  }

  assert.equal((await request('?kind=AURA')).status, 200)
  assert.equal((await request('?kind=ENCHANT&category=JACKET&role=buffer')).status, 200)
  assert.deepEqual(queries, [
    { kind: 'AURA' },
    { kind: 'ENCHANT', category: 'JACKET', role: 'buffer' }
  ])
})

test('조회는 명성 dense rank 1위를 종결, 2위를 준종결로 추천하고 가격 줄 상태에 따라 배지를 붙인다', async (t) => {
  const candidates = [
    candidate({ itemName: '합성 1', fame: 300 }),
    candidate({ itemName: '합성 2', fame: 300, itemId: null, unitPrice: null }),
    candidate({ itemName: '합성 3', fame: 250, unitPrice: null }),
    candidate({ itemName: '합성 4', fame: 200, itemId: null, unitPrice: null, checkedAt: null }),
    candidate({ itemName: '합성 5', fame: null })
  ]
  const request = await startOpsApp(t, memoryStore(candidates).store)

  const response = await request('?kind=TITLE')
  const { candidates: listed } = await response.json()

  assert.deepEqual(
    listed.map(({ itemName, recommendedTier, badge }: Record<string, unknown>) => ({
      itemName,
      recommendedTier,
      badge
    })),
    [
      { itemName: '합성 1', recommendedTier: '종결', badge: null },
      { itemName: '합성 2', recommendedTier: '종결', badge: '검색 없음' },
      { itemName: '합성 3', recommendedTier: '준종결', badge: '매물 없음' },
      { itemName: '합성 4', recommendedTier: null, badge: '미조회' },
      { itemName: '합성 5', recommendedTier: null, badge: null }
    ]
  )
  assert.equal(listed[0].checkedAt, '2026-11-28T01:00:00.000Z')
})

test('조회는 착용 수와 착용 집계 시각을 후보마다 낸다', async (t) => {
  const wearCountedAt = new Date('2026-11-28T15:30:00.000Z')
  const candidates = [
    candidate({ itemName: '합성 1', wearCount: 3417, wearCountedAt }),
    candidate({ itemName: '합성 2', wearCount: 0, wearCountedAt })
  ]
  const request = await startOpsApp(t, memoryStore(candidates).store)

  const response = await request('?kind=TITLE')
  const { candidates: listed } = await response.json()

  assert.deepEqual(
    listed.map(({ itemName, wearCount, wearCountedAt }: Record<string, unknown>) => [
      itemName,
      wearCount,
      wearCountedAt
    ]),
    [
      ['합성 1', 3417, '2026-11-28T15:30:00.000Z'],
      ['합성 2', 0, '2026-11-28T15:30:00.000Z']
    ]
  )
})

test('가격 이력은 이름을 query로 받아 저장소가 준 순서의 앞 200건까지 낸다', async (t) => {
  const { store, history } = memoryStore()
  const itemName = '합성 칭호 (보주, 선택)'
  history.set(
    itemName,
    Array.from({ length: 205 }, (_, index) => ({
      id: 205 - index,
      itemName,
      itemId: 'synthetic-id',
      unitPrice: 1000 + index,
      checkedAt: new Date(Date.UTC(2026, 10, 28) - index * 3_600_000)
    }))
  )
  const request = await startOpsApp(t, store)

  const response = await request(`/history?itemName=${encodeURIComponent(itemName)}`)
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.history.length, 200)
  assert.equal(body.history[0].id, 205)
  assert.equal(body.history[0].checkedAt, '2026-11-28T00:00:00.000Z')
  assert.equal(body.history[199].id, 6)
  assert.equal((await request('/history')).status, 400)
})
