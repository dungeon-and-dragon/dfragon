import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate as nextTurn } from 'node:timers/promises'
import type { CollectionSummary } from '@dfragon/database'
import { createCatalogService } from '../src/application/character-catalog/service.js'
import type { CharacterIdentity } from '../src/domain/character-identity.js'
import type { CharacterPayloads } from '../src/domain/character-detail/sections.js'
import { EMPTY_CHARACTER_TIMELINE } from '../src/domain/character-timeline/project.js'
import { createSeasonBackfillQueue } from '../src/application/character-timeline/season-backfill.js'
import { createApiHttpApp } from '../src/runtime/api-app.js'
import { createOpsHttpApp, type OpsHttpAppOptions } from '../src/runtime/ops-app.js'
import type { OpsBatchNeopleKeyStore, OpsCollectionStore } from '../src/application/ops/ports.js'

function gate() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })

  return { promise, release }
}

const unusedJobs = async () => assert.fail('queue, 수집 대기열 경로 테스트는 job을 읽으면 안 된다')

const unusedBatchNeopleKeys = async () =>
  assert.fail('queue, 수집 대기열 경로 테스트는 batch key를 다루면 안 된다')
const unusedBatchNeopleKeyStore: OpsBatchNeopleKeyStore = {
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

const unusedCollection: OpsCollectionStore = {
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
  const store: OpsCollectionStore = {
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

test('queue 개수는 처리 중인 일과 동시 실행 한도에 막혀 기다리는 일을 따로 세고, 닫으면 대기만 비운다', async () => {
  const running = gate()
  const queue = createSeasonBackfillQueue(
    () => running.promise,
    () => assert.fail('백필 실패가 보고되면 안 된다')
  )
  const range = { start: new Date('2025-01-09T00:00:00Z'), end: new Date('2025-03-01T00:00:00Z') }
  for (const characterId of ['a', 'b', 'c', 'd']) {
    queue.request({ character: { serverId: 'cain', characterId }, seasonId: 1, range })
  }
  queue.request({ character: { serverId: 'cain', characterId: 'a' }, seasonId: 1, range })

  assert.deepEqual(queue.counts(), { waiting: 2, running: 2 })

  queue.close()

  assert.deepEqual(queue.counts(), { waiting: 0, running: 2 })

  running.release()
  await nextTurn()

  assert.deepEqual(queue.counts(), { waiting: 0, running: 0 })
})

// 합성 캐릭터다. 상세 조회가 성공해야 타임라인 queue에 일이 들어간다.
function detailPayloads(identity: CharacterIdentity): CharacterPayloads {
  const common = { ...identity, characterName: '합성 캐릭터', jobId: 'job' }

  return {
    basic: { ...common },
    status: { ...common, status: [], buff: [] },
    equipment: { ...common, equipment: [], setItemInfo: [] },
    avatar: { ...common, avatar: [] },
    creature: { ...common, creature: null },
    oath: { ...common, oath: null },
    mist_assimilation: { ...common, mistAssimilation: null },
    skill_style: { ...common, skill: { style: { active: [] } } },
    buff_equipment: { ...common, skill: { buff: null } },
    buff_avatar: { ...common, skill: { buff: null } },
    buff_creature: { ...common, skill: { buff: null } }
  }
}

test('운영 queue 경로는 공개 app의 타임라인 동기화, 강화 백필, 옛 시즌 백필 queue 개수를 각각 준다', async (t) => {
  const blocked = gate()
  const { app: publicApp, readQueueCounts } = await createApiHttpApp({
    search: { searchCharacters: async () => assert.fail('검색을 부르면 안 된다') },
    details: {
      fetchDetails: async (identity) => detailPayloads(identity),
      catalog: createCatalogService(async () => new Map())
    },
    timeline: {
      sync: () => blocked.promise,
      backfillEnhancements: async ({ characterId }) => {
        if (characterId === 'first') {
          await blocked.promise
        }
      },
      backfillSeason: async () => assert.fail('옛 시즌 받기를 부르면 안 된다'),
      read: async () => EMPTY_CHARACTER_TIMELINE,
      readPage: async () => assert.fail('이어 받기를 부르면 안 된다'),
      close: async () => undefined
    },
    todayGrade: { fetchShopGrade: async () => assert.fail('오늘의 등급을 부르면 안 된다') },
    writeAccessLog: () => undefined
  })
  t.after(async () => {
    blocked.release()
    await publicApp.close()
  })
  await publicApp.listen(0, '127.0.0.1')
  const publicOrigin = await publicApp.getUrl()
  const request = await startOpsApp(t, {
    readQueueCounts,
    collection: unusedCollection
  })

  for (const characterId of ['first', 'second']) {
    const detail = await fetch(`${publicOrigin}/characters/cain/${characterId}`)
    assert.equal(detail.status, 200, characterId)
  }
  const response = await request('/api/queues')

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    queues: [
      { name: 'timeline-sync', waiting: 0, running: 2 },
      { name: 'enhancement-backfill', waiting: 0, running: 1 },
      { name: 'season-backfill', waiting: 0, running: 0 }
    ]
  })
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
