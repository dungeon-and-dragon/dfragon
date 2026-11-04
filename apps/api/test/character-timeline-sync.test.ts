import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate as nextTurn } from 'node:timers/promises'
import type { TimelineCharacter, TimelineRange, TimelineSyncState } from '@dfragon/database'
import { createCatalogService } from '../src/characters/catalog/service.js'
import { CharacterDetailFailure } from '../src/characters/details/errors.js'
import type { NeopleStageTimings } from '../src/characters/details/neople-stages.js'
import type { CharacterPayloads } from '../src/characters/details/sections.js'
import { createCharacterDetailService } from '../src/characters/details/service.js'
import { TimelineFailure } from '../src/characters/timeline/errors.js'
import type { FetchCharacterTimeline } from '../src/characters/timeline/neople.js'
import { createTimelineSyncQueue } from '../src/characters/timeline/queue.js'
import type { TimelineInputs } from '../src/characters/timeline/rows.js'
import {
  type TimelineStore,
  type TimelineSyncFailure,
  syncCharacterTimeline
} from '../src/characters/timeline/sync.js'
import { createApiHttpApp } from '../src/http.js'
import {
  CHARACTER_FETCHED,
  CharacterEvents,
  type CharacterFetched
} from '../src/characters/events.js'
import type { CharacterIdentity } from '../src/characters/identity.js'
import { EventEmitter2 } from '@nestjs/event-emitter'

const character = { serverId: 'siroco', characterId: 'timeline-fixture' }
const MINUTE_MS = 60 * 1000
const DAY_MS = 24 * 60 * MINUTE_MS
// #1175가 정한 수집 시작(중천 시즌 시작)이다.
const SEASON_START = new Date('2025-01-09T06:00:00+09:00')

function gate() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })

  return { promise, release }
}

// 저장 함수와 같은 상태 전이를 메모리에 흉내 낸 fake이며 DB를 쓰지 않는다.
function memoryStore(initial?: TimelineSyncState) {
  let state = initial
  const replaced: TimelineRange[] = []
  const failures: TimelineSyncFailure[] = []
  let successes = 0
  const store: TimelineStore = {
    readSyncState: async () => state,
    replaceRange: async (_character, range) => {
      replaced.push(range)
      state = { syncedUntil: range.end, lastSucceededAt: state?.lastSucceededAt ?? null }
    },
    recordSuccess: async () => {
      successes++
    },
    recordFailure: async (_character, failure) => {
      failures.push(failure)
    }
  }

  return {
    store,
    replaced,
    failures,
    successes: () => successes,
    syncedUntil: () => state?.syncedUntil
  }
}

const emptyInputs: TimelineInputs = { events: [], items: [] }

test('같은 캐릭터를 대기 중이나 처리 중에 여러 번 넣어도 한 번만 동기화한다', async () => {
  const running = gate()
  const synced: TimelineCharacter[] = []
  const queue = createTimelineSyncQueue(
    async (requested) => {
      synced.push(requested)
      await running.promise
    },
    () => assert.fail('동기화 실패가 보고되면 안 된다')
  )
  const others = [
    { serverId: 'siroco', characterId: 'other-1' },
    { serverId: 'cain', characterId: 'timeline-fixture' }
  ]

  queue.request(character)
  queue.request(character)
  for (const other of others) {
    queue.request(other)
  }
  queue.request(others[1]!)
  queue.request(character)
  await nextTurn()

  assert.deepEqual(synced, [character, others[0]])

  running.release()
  await nextTurn()

  assert.deepEqual(synced, [character, ...others])
})

test('동기화가 실패를 기록하지 못하면 보고하고 다음 캐릭터를 이어 처리한다', async () => {
  const running = gate()
  let reported = 0
  const synced: string[] = []
  const queue = createTimelineSyncQueue(
    async ({ characterId }) => {
      synced.push(characterId)
      if (characterId === 'broken') {
        throw new Error('database closed')
      }
      await running.promise
    },
    () => {
      reported++
    }
  )

  // 동시 처리 2개 가운데 실패한 슬롯이 비어야 세 번째가 시작한다.
  for (const characterId of ['broken', 'second', 'third', 'fourth']) {
    queue.request({ serverId: 'siroco', characterId })
  }
  await nextTurn()

  assert.equal(reported, 1)
  assert.deepEqual(synced, ['broken', 'second', 'third'])
  running.release()
})

test('queue를 닫으면 진행 중인 동기화는 두고 대기 중인 캐릭터는 시작하지 않는다', async () => {
  const running = gate()
  const synced: string[] = []
  const finished: string[] = []
  const queue = createTimelineSyncQueue(
    async ({ characterId }) => {
      synced.push(characterId)
      await running.promise
      finished.push(characterId)
    },
    () => assert.fail('동기화 실패가 보고되면 안 된다')
  )

  for (const characterId of ['first', 'second', 'waiting']) {
    queue.request({ serverId: 'siroco', characterId })
  }
  queue.close()
  queue.request({ serverId: 'siroco', characterId: 'after-close' })
  running.release()
  await nextTurn()

  assert.deepEqual(synced, ['first', 'second'])
  assert.deepEqual(finished, ['first', 'second'])
})

test('마지막 성공이 1시간 이내면 Neople을 부르지 않는다', async () => {
  const now = new Date('2026-11-04T12:00:00Z')
  const recent = memoryStore({
    syncedUntil: new Date('2026-11-04T11:01:00Z'),
    lastSucceededAt: new Date(now.getTime() - 59 * MINUTE_MS)
  })
  let calls = 0
  const fetchTimeline = async () => {
    calls++

    return emptyInputs
  }

  await syncCharacterTimeline(character, { fetchTimeline, store: recent.store, now: () => now })

  assert.equal(calls, 0)
  assert.equal(recent.successes(), 0)
  assert.deepEqual(recent.failures, [])

  const stale = memoryStore({
    syncedUntil: new Date('2026-11-04T11:00:00Z'),
    lastSucceededAt: new Date(now.getTime() - 61 * MINUTE_MS)
  })

  await syncCharacterTimeline(character, { fetchTimeline, store: stale.store, now: () => now })

  assert.equal(calls, 1)
  assert.equal(stale.successes(), 1)
})

test('다시 받을 때는 기록 지연을 감안해 마지막 동기화 위치보다 30분 앞에서 시작한다', async () => {
  const now = new Date('2026-11-04T12:00:00Z')
  const stale = memoryStore({
    syncedUntil: new Date('2026-11-04T11:00:00Z'),
    lastSucceededAt: new Date('2026-11-04T10:00:00Z')
  })

  await syncCharacterTimeline(character, {
    fetchTimeline: async () => emptyInputs,
    store: stale.store,
    now: () => now
  })

  assert.deepEqual(stale.replaced, [{ start: new Date('2026-11-04T10:30:00Z'), end: now }])
})

test('마지막 동기화 위치가 중천 시작 30분 안이면 중천 시작보다 앞에서 받지 않는다', async () => {
  const now = new Date(SEASON_START.getTime() + 2 * 60 * MINUTE_MS)
  const early = memoryStore({
    syncedUntil: new Date(SEASON_START.getTime() + 10 * MINUTE_MS),
    lastSucceededAt: new Date(SEASON_START.getTime() - 60 * MINUTE_MS)
  })

  await syncCharacterTimeline(character, {
    fetchTimeline: async () => emptyInputs,
    store: early.store,
    now: () => now
  })

  assert.deepEqual(early.replaced, [{ start: SEASON_START, end: now }])
})

test('처음 동기화는 중천 시작부터 90일 구간을 앞에서부터 받고 모두 저장하면 성공을 기록한다', async () => {
  const now = new Date(SEASON_START.getTime() + 200 * DAY_MS)
  const fresh = memoryStore()
  const requested: TimelineRange[] = []
  const fetchTimeline: FetchCharacterTimeline = async (_identity, range) => {
    requested.push(range)

    return emptyInputs
  }

  await syncCharacterTimeline(character, { fetchTimeline, store: fresh.store, now: () => now })

  assert.equal(requested[0]!.start.getTime(), SEASON_START.getTime())
  assert.equal(requested.at(-1)!.end.getTime(), now.getTime())
  assert.deepEqual(fresh.replaced, requested)
  assert.equal(requested.length, 3)
  assert.equal(fresh.syncedUntil()?.getTime(), now.getTime())
  assert.equal(fresh.successes(), 1)
  assert.deepEqual(fresh.failures, [])
})

test('세 번째 구간에서 Neople이 실패하면 앞 두 구간만 저장되고 실패가 기록된다', async () => {
  const now = new Date(SEASON_START.getTime() + 200 * DAY_MS)
  const fresh = memoryStore()
  let calls = 0
  const fetchTimeline = async () => {
    calls++
    if (calls === 3) {
      throw new TimelineFailure('unavailable')
    }

    return emptyInputs
  }

  await syncCharacterTimeline(character, { fetchTimeline, store: fresh.store, now: () => now })

  assert.equal(fresh.replaced.length, 2)
  assert.equal(fresh.replaced[0]!.start.getTime(), SEASON_START.getTime())
  assert.equal(fresh.syncedUntil()?.getTime(), fresh.replaced[1]!.end.getTime())
  assert.equal(fresh.successes(), 0)
  assert.deepEqual(fresh.failures, ['neople-unavailable'])
})

test('저장이 실패하면 DB 실패를 기록하고 다음 구간을 받지 않는다', async () => {
  const now = new Date(SEASON_START.getTime() + 200 * DAY_MS)
  const fresh = memoryStore()
  fresh.store.replaceRange = async () => {
    throw new Error('connection refused')
  }
  let calls = 0
  const fetchTimeline = async () => {
    calls++

    return emptyInputs
  }

  await syncCharacterTimeline(character, { fetchTimeline, store: fresh.store, now: () => now })

  assert.equal(calls, 1)
  assert.equal(fresh.successes(), 0)
  assert.deepEqual(fresh.failures, ['database'])
})

const ignoredTimings: NeopleStageTimings = { record: () => undefined, markShared: () => undefined }
const signal = new AbortController().signal
const common = { ...character, characterName: '합성 캐릭터', jobId: 'job' }
const payloads: CharacterPayloads = {
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

test('상세 조회는 캐시 적중에도 캐릭터를 받았다고 알리고, 캐릭터를 받지 못하면 알리지 않는다', async (t) => {
  const fetched: CharacterIdentity[] = []
  const emitter = new EventEmitter2()
  emitter.on(CHARACTER_FETCHED, (event: CharacterFetched) => fetched.push({ ...event }))
  let found = true
  const service = createCharacterDetailService({
    catalog: createCatalogService(async () => new Map()),
    fetchDetails: async () => {
      if (!found) {
        throw new CharacterDetailFailure('api')
      }

      return payloads
    },
    calculateScore: async () => null,
    characterEvents: new CharacterEvents(emitter)
  })
  t.after(() => service.onModuleDestroy())

  await service.get(character, signal, ignoredTimings)
  const cached = await service.get(character, signal, ignoredTimings)
  found = false
  const missing = { serverId: 'siroco', characterId: 'missing' }
  await assert.rejects(service.get(missing, signal, ignoredTimings), CharacterDetailFailure)

  assert.equal(cached.reused, true)
  assert.deepEqual(fetched, [character, character])
})

// 닫기가 동기화를 기다리게 바뀌면 멈추지 않고 실패하도록 timeout을 둔다.
test('앱을 닫으면 진행 중인 동기화를 기다리지 않고 대기열을 버린 뒤 타임라인 저장소를 닫는다', {
  timeout: 10_000
}, async () => {
  const running = gate()
  let closed = 0
  let synced = 0
  const app = await createApiHttpApp({
    search: { searchCharacters: async () => assert.fail('검색을 부르면 안 된다') },
    details: {
      fetchDetails: async () => payloads,
      catalog: createCatalogService(async () => new Map())
    },
    timeline: {
      sync: async () => {
        synced++
        await running.promise
      },
      close: async () => {
        closed++
      }
    },
    todayGrade: { fetchShopGrade: async () => assert.fail('오늘의 등급을 부르면 안 된다') },
    writeAccessLog: () => undefined
  })
  await app.listen(0, '127.0.0.1')
  const origin = await app.getUrl()
  // 동시 처리가 2명이라 세 번째 캐릭터는 대기열에 남는다.
  for (const characterId of ['first', 'second', 'waiting']) {
    const response = await fetch(new URL(`/characters/siroco/${characterId}`, origin))
    assert.equal(response.status, 200)
  }

  assert.equal(synced, 2)

  await app.close()
  running.release()
  await nextTurn()

  assert.equal(closed, 1)
  assert.equal(synced, 2)
})
