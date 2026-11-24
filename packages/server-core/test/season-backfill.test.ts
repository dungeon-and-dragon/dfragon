import assert from 'node:assert/strict'
import test from 'node:test'
import type { SeasonBackfillState, TimelineCharacter, TimelineRange } from '@dfragon/database'
import type { FetchCharacterTimeline } from '../src/application/character-timeline/ports.js'
import type { SeasonBackfillRepository } from '../src/application/character-timeline/repository.js'
import { SeasonBackfillService } from '../src/application/character-timeline/season-backfill.js'
import { type SeasonBackfillJob, TimelineFailure } from '../src/domain/character-timeline/index.js'

const at = (time: string) => new Date(`${time}+09:00`)
const MINUTE_MS = 60_000
const ranges = new Map<number, TimelineRange>([
  [5, { start: at('2017-09-21T00:00:00'), end: at('2018-08-09T05:59:00') }],
  [7, { start: at('2020-01-09T06:00:00'), end: at('2022-03-17T05:59:00') }],
  [9, { start: at('2023-09-14T06:00:00'), end: at('2025-01-09T05:59:00') }]
])
const character = { serverId: 'cain', characterId: 'season-backfill' }

function seasonRange(seasonId: number): TimelineRange {
  const range = ranges.get(seasonId)
  assert.ok(range, `시즌 ${seasonId}`)

  return range
}

function state(
  { serverId, characterId }: TimelineCharacter,
  backfilledUntil: Date,
  completedAt: Date | null = null
): SeasonBackfillState {
  return { serverId, characterId, backfilledUntil, completedAt }
}

// 저장 함수와 같은 상태 전이를 메모리에 흉내 낸 fake이며 DB를 쓰지 않는다.
function memoryStore(initial?: SeasonBackfillState) {
  let current = initial
  const replaced: TimelineRange[] = []
  const store: SeasonBackfillRepository = {
    readState: async () => current,
    replaceRange: async (requested, _seasonId, range) => {
      replaced.push(range)
      current = state(requested, range.end, current?.completedAt ?? null)
    },
    recordCompleted: async () => {
      assert.ok(current, '받은 구간이 없으면 끝까지 받음을 기록할 수 없다')
      current = { ...current, completedAt: at('2026-11-07T12:00:00') }
    }
  }

  return { store, replaced, state: () => current }
}

function job(seasonId: number): SeasonBackfillJob {
  return { character, seasonId, range: seasonRange(seasonId) }
}

test('처음 받으면 시즌 구간을 앞 구간부터 빈틈없이 모든 코드로 받고 끝까지 받음을 기록한다', async () => {
  const fresh = memoryStore()
  const requested: TimelineRange[] = []
  const fetchTimeline: FetchCharacterTimeline = async (_identity, range) => {
    requested.push(range)

    return { events: [], items: [] }
  }

  await new SeasonBackfillService(fresh.store, fetchTimeline).backfill(job(5))

  assert.deepEqual(fresh.replaced, requested)
  assert.equal(requested.length, 4)
  assert.equal(requested[0]!.start.getTime(), at('2017-09-21T00:00:00').getTime())
  assert.equal(requested.at(-1)!.end.getTime(), at('2018-08-09T05:59:00').getTime())
  for (const [index, range] of requested.slice(1).entries()) {
    assert.equal(range.start.getTime(), requested[index]!.end.getTime() + MINUTE_MS)
  }
  assert.ok(fresh.state()?.completedAt)
})

test('받은 위치가 있으면 그다음 분부터 이어 받고, 끝까지 받았으면 Neople을 부르지 않는다', async () => {
  const resumedAt = at('2024-12-01T00:00:00')
  const resumed = memoryStore(state(character, resumedAt))
  const requested: TimelineRange[] = []
  const fetchTimeline: FetchCharacterTimeline = async (_identity, range) => {
    requested.push(range)

    return { events: [], items: [] }
  }

  await new SeasonBackfillService(resumed.store, fetchTimeline).backfill(job(9))

  assert.deepEqual(requested, [
    { start: new Date(resumedAt.getTime() + MINUTE_MS), end: at('2025-01-09T05:59:00') }
  ])
  assert.ok(resumed.state()?.completedAt)

  const completed = memoryStore(state(character, seasonRange(9).end, at('2026-11-01T00:00:00')))
  await new SeasonBackfillService(completed.store, async () =>
    assert.fail('끝까지 받은 캐릭터는 Neople을 부르면 안 된다')
  ).backfill(job(9))

  assert.deepEqual(completed.replaced, [])
})

test('구간을 받다가 실패하면 저장한 구간까지 남기고 멈추며 끝까지 받음을 기록하지 않는다', async () => {
  const failing = memoryStore()
  let calls = 0
  const fetchTimeline: FetchCharacterTimeline = async () => {
    calls++
    if (calls === 2) {
      throw new TimelineFailure('unavailable')
    }

    return { events: [], items: [] }
  }

  await assert.rejects(
    new SeasonBackfillService(failing.store, fetchTimeline).backfill(job(7)),
    TimelineFailure
  )

  assert.equal(calls, 2)
  assert.equal(failing.replaced.length, 1)
  assert.equal(failing.state()?.backfilledUntil.getTime(), at('2020-04-07T05:59:00').getTime())
  assert.equal(failing.state()?.completedAt, null)
})
