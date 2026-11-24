import assert from 'node:assert/strict'
import test from 'node:test'
import type {
  TimelineEventInput,
  TimelineItemInput,
  TimelineRange,
  TimelineSyncState
} from '@dfragon/database'
import type { FetchCharacterTimeline } from '../src/application/character-timeline/ports.js'
import type { TimelineSyncRepository } from '../src/application/character-timeline/repository.js'
import { TimelineSyncService } from '../src/application/character-timeline/sync.js'
import {
  TimelineFailure,
  type TimelineInputs,
  type TimelineSyncFailure
} from '../src/domain/character-timeline/index.js'

const character = { serverId: 'siroco', characterId: 'timeline-fixture' }
const MINUTE_MS = 60 * 1000
const DAY_MS = 24 * 60 * MINUTE_MS
// #1175가 정한 수집 시작(중천 시즌 시작)이다.
const SEASON_START = new Date('2025-01-09T06:00:00+09:00')

// 저장 함수와 같은 상태 전이를 메모리에 흉내 낸 fake이며 DB를 쓰지 않는다.
function memoryStore(initial?: TimelineSyncState) {
  let state = initial
  const replaced: TimelineRange[] = []
  const failures: TimelineSyncFailure[] = []
  const activeAt: Date[] = []
  let successes = 0
  const store: TimelineSyncRepository = {
    readSyncState: async () => state,
    replaceRange: async (_character, range) => {
      replaced.push(range)
      state = { syncedUntil: range.end, lastSucceededAt: state?.lastSucceededAt ?? null }
    },
    recordActive: async (_character, lastActiveAt) => {
      activeAt.push(lastActiveAt)
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
    activeAt,
    successes: () => successes,
    syncedUntil: () => state?.syncedUntil
  }
}

const emptyInputs: TimelineInputs = { events: [], items: [] }
const noItemDictionary = { fill: async () => 0 }
const unexpectedItemDictionaryFailure = () => assert.fail('사전 채우기 실패가 보고되면 안 된다')

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

  await new TimelineSyncService(recent.store, fetchTimeline, noItemDictionary, () => now).sync(
    character,
    unexpectedItemDictionaryFailure
  )

  assert.equal(calls, 0)
  assert.equal(recent.successes(), 0)
  assert.deepEqual(recent.failures, [])

  const stale = memoryStore({
    syncedUntil: new Date('2026-11-04T11:00:00Z'),
    lastSucceededAt: new Date(now.getTime() - 61 * MINUTE_MS)
  })

  await new TimelineSyncService(stale.store, fetchTimeline, noItemDictionary, () => now).sync(
    character,
    unexpectedItemDictionaryFailure
  )

  assert.equal(calls, 1)
  assert.equal(stale.successes(), 1)
})

test('다시 받을 때는 기록 지연을 감안해 마지막 동기화 위치보다 30분 앞에서 시작한다', async () => {
  const now = new Date('2026-11-04T12:00:00Z')
  const stale = memoryStore({
    syncedUntil: new Date('2026-11-04T11:00:00Z'),
    lastSucceededAt: new Date('2026-11-04T10:00:00Z')
  })

  await new TimelineSyncService(
    stale.store,
    async () => emptyInputs,
    noItemDictionary,
    () => now
  ).sync(character, unexpectedItemDictionaryFailure)

  assert.deepEqual(stale.replaced, [{ start: new Date('2026-11-04T10:30:00Z'), end: now }])
})

test('마지막 동기화 위치가 중천 시작 30분 안이면 중천 시작보다 앞에서 받지 않는다', async () => {
  const now = new Date(SEASON_START.getTime() + 2 * 60 * MINUTE_MS)
  const early = memoryStore({
    syncedUntil: new Date(SEASON_START.getTime() + 10 * MINUTE_MS),
    lastSucceededAt: new Date(SEASON_START.getTime() - 60 * MINUTE_MS)
  })

  await new TimelineSyncService(
    early.store,
    async () => emptyInputs,
    noItemDictionary,
    () => now
  ).sync(character, unexpectedItemDictionaryFailure)

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

  await new TimelineSyncService(fresh.store, fetchTimeline, noItemDictionary, () => now).sync(
    character,
    unexpectedItemDictionaryFailure
  )

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

  await new TimelineSyncService(fresh.store, fetchTimeline, noItemDictionary, () => now).sync(
    character,
    unexpectedItemDictionaryFailure
  )

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

  await new TimelineSyncService(fresh.store, fetchTimeline, noItemDictionary, () => now).sync(
    character,
    unexpectedItemDictionaryFailure
  )

  assert.equal(calls, 1)
  assert.equal(fresh.successes(), 0)
  assert.deepEqual(fresh.failures, ['database'])
})

function eventAt(occurredAt: Date): TimelineEventInput {
  return { code: 102, occurredAt, name: '캐릭터명 변경', raidName: null, data: {} }
}

function itemAt(occurredAt: Date): TimelineItemInput {
  return {
    code: 402,
    occurredAt,
    name: '아이템 증폭',
    itemId: 'synthetic-item',
    itemName: '합성 아이템',
    itemRarity: '에픽',
    data: {}
  }
}

test('받은 타임라인의 마지막 기록이 30일 안이면 그 시각을 마지막 활동으로 기록한다', async () => {
  const now = new Date(SEASON_START.getTime() + 200 * DAY_MS)
  const fresh = memoryStore()
  const older = new Date(SEASON_START.getTime() + 10 * DAY_MS)
  const sameRangeOlder = new Date(now.getTime() - 40 * DAY_MS)
  const latest = new Date(now.getTime() - 29 * DAY_MS)
  const inRange = (range: TimelineRange) => (at: Date) => at > range.start && at <= range.end
  const fetchTimeline: FetchCharacterTimeline = async (_identity, range) => {
    const events = [sameRangeOlder, older].filter(inRange(range)).map(eventAt)
    const items = [latest].filter(inRange(range)).map(itemAt)

    return { events, items }
  }

  await new TimelineSyncService(fresh.store, fetchTimeline, noItemDictionary, () => now).sync(
    character,
    unexpectedItemDictionaryFailure
  )

  assert.deepEqual(fresh.activeAt, [latest])
  assert.equal(fresh.successes(), 1)
})

test('받은 타임라인의 마지막 기록이 30일 지났거나 기록이 없으면 활동을 기록하지 않는다', async () => {
  const now = new Date(SEASON_START.getTime() + 200 * DAY_MS)
  const idle = memoryStore()
  const stale = new Date(now.getTime() - 30 * DAY_MS)
  const fetchStale: FetchCharacterTimeline = async (_identity, range) => {
    const events = stale > range.start && stale <= range.end ? [eventAt(stale)] : []

    return { events, items: [] }
  }

  await new TimelineSyncService(idle.store, fetchStale, noItemDictionary, () => now).sync(
    character,
    unexpectedItemDictionaryFailure
  )

  assert.deepEqual(idle.activeAt, [])
  assert.equal(idle.successes(), 1)

  const empty = memoryStore()

  await new TimelineSyncService(
    empty.store,
    async () => emptyInputs,
    noItemDictionary,
    () => now
  ).sync(character, unexpectedItemDictionaryFailure)

  assert.deepEqual(empty.activeAt, [])
})
