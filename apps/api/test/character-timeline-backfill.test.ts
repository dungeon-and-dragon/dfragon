import assert from 'node:assert/strict'
import test from 'node:test'
import type { TimelineItemInput, TimelineRange } from '@dfragon/database'
import { EnhancementBackfillService } from '../src/application/character-timeline/backfill.js'
import type { EnhancementBackfillRepository } from '../src/application/character-timeline/repository.js'
import { TimelineFailure } from '../src/domain/character-timeline/failure.js'
import type { FetchCharacterTimeline } from '../src/application/character-timeline/ports.js'
import type { TimelineInputs } from '../src/domain/character-timeline/rows.js'

const character = { serverId: 'siroco', characterId: 'backfill-fixture' }
const MINUTE_MS = 60 * 1000
// Neople이 타임라인을 주는 첫날(#1175 API 제약)과 정기 동기화가 받기 시작하는 중천 시작이다.
const NEOPLE_START = new Date('2017-09-21T00:00:00+09:00')
const SEASON_START = new Date('2025-01-09T06:00:00+09:00')
const BACKFILL_END = new Date(SEASON_START.getTime() - MINUTE_MS)

// 저장 함수와 같은 상태 전이를 메모리에 흉내 낸 fake이며 DB를 쓰지 않는다.
function memoryStore(initial: Date | null = null) {
  let backfilledUntil = initial
  const replaced: { range: TimelineRange; items: readonly TimelineItemInput[] }[] = []
  const store: EnhancementBackfillRepository = {
    readBackfilledUntil: async () => backfilledUntil,
    replaceRange: async (_character, range, items) => {
      replaced.push({ range, items })
      backfilledUntil = range.end
    }
  }

  return { store, replaced, backfilledUntil: () => backfilledUntil }
}

const enhancement: TimelineItemInput = {
  code: 402,
  occurredAt: new Date('2020-01-01T00:00:00+09:00'),
  name: '아이템 증폭',
  itemId: 'synthetic-item',
  itemName: '합성 아이템',
  itemRarity: '에픽',
  data: { before: 9, after: 10, result: true }
}

function rangesOf(replaced: { range: TimelineRange }[]): TimelineRange[] {
  return replaced.map(({ range }) => range)
}

test('처음 백필은 Neople 첫날부터 중천 시작 직전까지 빈틈없이 앞 구간부터 받아 저장한다', async () => {
  const fresh = memoryStore()
  const requested: TimelineRange[] = []
  const fetchTimeline: FetchCharacterTimeline = async (_identity, range) => {
    requested.push(range)
    const items = requested.length === 1 ? [enhancement] : []

    return { events: [], items }
  }

  await new EnhancementBackfillService(fresh.store, fetchTimeline).backfill(character)

  assert.deepEqual(rangesOf(fresh.replaced), requested)
  assert.equal(requested[0]!.start.getTime(), NEOPLE_START.getTime())
  assert.equal(requested.at(-1)!.end.getTime(), BACKFILL_END.getTime())
  for (const [index, range] of requested.slice(1).entries()) {
    assert.equal(range.start.getTime(), requested[index]!.end.getTime() + MINUTE_MS)
  }
  assert.deepEqual(fresh.replaced[0]!.items, [enhancement])
  assert.equal(fresh.backfilledUntil()?.getTime(), BACKFILL_END.getTime())
})

test('백필 위치가 있으면 그다음 분부터 이어 받고, 끝까지 받았으면 Neople을 부르지 않는다', async () => {
  const resumed = memoryStore(new Date('2024-12-01T00:00:00+09:00'))
  const requested: TimelineRange[] = []
  const fetchTimeline: FetchCharacterTimeline = async (_identity, range) => {
    requested.push(range)

    return { events: [], items: [] }
  }

  await new EnhancementBackfillService(resumed.store, fetchTimeline).backfill(character)

  assert.deepEqual(requested, [{ start: new Date('2024-12-01T00:01:00+09:00'), end: BACKFILL_END }])

  await new EnhancementBackfillService(resumed.store, fetchTimeline).backfill(character)

  assert.equal(requested.length, 1)
})

test('세 번째 구간에서 Neople이 실패하면 앞 두 구간만 저장하고 실패를 그대로 던진다', async () => {
  const fresh = memoryStore()
  let calls = 0
  const fetchTimeline = async (): Promise<TimelineInputs> => {
    calls++
    if (calls === 3) {
      throw new TimelineFailure('unavailable')
    }

    return { events: [], items: [] }
  }

  await assert.rejects(
    new EnhancementBackfillService(fresh.store, fetchTimeline).backfill(character),
    TimelineFailure
  )

  assert.equal(fresh.replaced.length, 2)
  assert.equal(fresh.backfilledUntil()?.getTime(), fresh.replaced[1]!.range.end.getTime())
})
