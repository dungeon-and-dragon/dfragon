import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate as nextTurn } from 'node:timers/promises'
import type { TimelineEventRow, TimelineItemRow } from '@dfragon/database'
import { createCatalogService } from '../src/characters/catalog/service.js'
import { createTimelineSyncQueue } from '../src/characters/timeline/queue.js'
import { type CharacterTimeline, toCharacterTimeline } from '../src/characters/timeline/read.js'
import { createApiHttpApp } from '../src/http.js'
import { startOfResetWeek } from '../src/utils/seoul-time.js'

const character = { serverId: 'siroco', characterId: 'timeline-read-fixture' }
const unused = async (): Promise<never> => assert.fail('부르면 안 된다')

function gate() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })

  return { promise, release }
}

function settled(promise: Promise<unknown>): () => boolean {
  let done = false
  promise.then(
    () => {
      done = true
    },
    () => {
      done = true
    }
  )

  return () => done
}

function event(row: Partial<TimelineEventRow> & Pick<TimelineEventRow, 'code'>): TimelineEventRow {
  return {
    occurredAt: new Date('2026-11-05T12:00:00+09:00'),
    name: '레이드',
    raidName: null,
    data: {},
    ...row
  }
}

function item(row: Partial<TimelineItemRow> & Pick<TimelineItemRow, 'code'>): TimelineItemRow {
  return {
    occurredAt: new Date('2026-11-05T12:00:00+09:00'),
    name: '아이템',
    itemId: 'synthetic-item',
    itemName: '합성 아이템',
    itemRarity: '에픽',
    data: {},
    ...row
  }
}

test('한 주는 목요일 06:00(KST)에 시작한다', () => {
  const thisWeek = new Date('2026-11-05T06:00:00+09:00')
  const lastWeek = new Date('2026-10-29T06:00:00+09:00')

  for (const [now, expected] of [
    ['2026-11-05T06:00:00+09:00', thisWeek],
    ['2026-11-05T05:59:59+09:00', lastWeek],
    ['2026-11-04T23:00:00+09:00', lastWeek],
    ['2026-11-11T23:59:00+09:00', thisWeek]
  ] as const) {
    assert.equal(startOfResetWeek(new Date(now)).toISOString(), expected.toISOString(), now)
  }
})

test('레이드는 raid_name, 레기온은 regionName을 이름으로 쓰고 시즌 클리어는 종류와 이름별로 센다', () => {
  const weekStart = new Date('2026-11-05T06:00:00+09:00')
  const seasonStart = new Date('2026-03-26T06:00:00+09:00')
  const raid = { raidName: '디레지에 레이드', data: { modeName: '디레지에 : 악연' } }
  const timeline = toCharacterTimeline(
    {
      clears: [
        event({ code: 201, occurredAt: new Date('2026-03-26T05:59:00+09:00'), ...raid }),
        event({ code: 201, occurredAt: new Date('2026-11-05T05:59:00+09:00'), ...raid }),
        event({ code: 201, occurredAt: weekStart, ...raid }),
        event({
          code: 210,
          occurredAt: new Date('2026-11-05T08:00:00+09:00'),
          raidName: '이내 황혼전'
        }),
        event({
          code: 209,
          occurredAt: new Date('2026-11-05T09:00:00+09:00'),
          data: { regionName: '베누스' }
        })
      ],
      enhancements: [],
      acquisitions: []
    },
    weekStart,
    seasonStart
  )

  assert.deepEqual(timeline.weeklyClears, [
    { kind: 'raid', name: '디레지에 레이드', modeName: '디레지에 : 악연', occurredAt: weekStart },
    {
      kind: 'raid',
      name: '이내 황혼전',
      modeName: null,
      occurredAt: new Date('2026-11-05T08:00:00+09:00')
    },
    {
      kind: 'legion',
      name: '베누스',
      modeName: null,
      occurredAt: new Date('2026-11-05T09:00:00+09:00')
    }
  ])
  assert.deepEqual(timeline.seasonClears, [
    { kind: 'raid', name: '디레지에 레이드', count: 2 },
    { kind: 'raid', name: '이내 황혼전', count: 1 },
    { kind: 'legion', name: '베누스', count: 1 }
  ])
})

test('강화, 증폭, 재련의 종류를 나누고 재련에 없는 before, safe는 null로 둔다', () => {
  const occurredAt = new Date('2026-11-05T12:00:00+09:00')
  const timeline = toCharacterTimeline(
    {
      clears: [],
      enhancements: [
        item({
          code: 402,
          data: { safe: false, after: 13, before: 12, result: false },
          occurredAt
        }),
        item({ code: 403, itemRarity: '유니크', data: { after: 8, result: true }, occurredAt }),
        item({ code: 401, data: { safe: true, after: 10, before: 9, result: true }, occurredAt })
      ],
      acquisitions: []
    },
    occurredAt,
    occurredAt
  )

  assert.deepEqual(
    timeline.enhancements.map(({ kind, itemRarity, before, after, result, safe }) => ({
      kind,
      itemRarity,
      before,
      after,
      result,
      safe
    })),
    [
      { kind: 'amplify', itemRarity: '에픽', before: 12, after: 13, result: false, safe: false },
      { kind: 'refine', itemRarity: '유니크', before: null, after: 8, result: true, safe: null },
      { kind: 'reinforce', itemRarity: '에픽', before: 9, after: 10, result: true, safe: true }
    ]
  )
})

test('형식이 다른 선택 필드는 null로 두고 이름, after, result가 맞지 않는 행은 뺀다', () => {
  const occurredAt = new Date('2026-11-05T12:00:00+09:00')
  const timeline = toCharacterTimeline(
    {
      clears: [
        event({ code: 201, raidName: '디레지에 레이드', data: { modeName: 3 } }),
        event({ code: 209, data: { regionName: null } }),
        event({ code: 210, raidName: null, data: { modeName: '합성 난이도' } })
      ],
      enhancements: [
        item({ code: 401, data: { before: '9', after: 10, result: true, safe: 'yes' } }),
        item({ code: 402, data: { before: 12, result: false } }),
        item({ code: 403, data: { after: '8', result: true } }),
        item({ code: 402, data: { after: 13, result: 'false' } })
      ],
      acquisitions: []
    },
    occurredAt,
    occurredAt
  )

  assert.deepEqual(timeline.weeklyClears, [
    { kind: 'raid', name: '디레지에 레이드', modeName: null, occurredAt }
  ])
  assert.deepEqual(
    timeline.enhancements.map(({ kind, before, after, result, safe }) => ({
      kind,
      before,
      after,
      result,
      safe
    })),
    [{ kind: 'reinforce', before: null, after: 10, result: true, safe: null }]
  )
})

test('기다리는 요청은 대기 중이던 그 캐릭터의 동기화가 끝난 뒤 풀리고 같은 동기화를 함께 기다린다', async () => {
  const gates = new Map([
    ['first', gate()],
    ['second', gate()],
    [character.characterId, gate()]
  ])
  const synced: string[] = []
  const queue = createTimelineSyncQueue(
    async ({ characterId }) => {
      synced.push(characterId)
      await gates.get(characterId)!.promise
    },
    () => assert.fail('동기화 실패가 보고되면 안 된다')
  )
  queue.request({ serverId: 'siroco', characterId: 'first' })
  queue.request({ serverId: 'siroco', characterId: 'second' })
  // 동시 처리가 2명이라 이 캐릭터는 대기열에 남는다.
  const waited = settled(queue.requestAndWait(character))
  const waitedAgain = settled(queue.requestAndWait(character))

  gates.get('first')!.release()
  await nextTurn()

  assert.deepEqual(synced, ['first', 'second', character.characterId])
  assert.equal(waited(), false)

  gates.get(character.characterId)!.release()
  await nextTurn()

  assert.equal(waited(), true)
  assert.equal(waitedAgain(), true)
  assert.deepEqual(synced, ['first', 'second', character.characterId])
  gates.get('second')!.release()
})

test('동기화가 실패를 기록하지 못해도 기다리는 요청은 풀린다', async () => {
  let reported = 0
  const queue = createTimelineSyncQueue(
    async () => {
      throw new Error('database closed')
    },
    () => {
      reported++
    }
  )

  await queue.requestAndWait(character)

  assert.equal(reported, 1)
})

test('queue를 닫으면 대기열에서 기다리던 요청은 동기화 없이 풀리고 진행 중인 동기화는 끝을 기다린다', async () => {
  const running = gate()
  const synced: string[] = []
  const queue = createTimelineSyncQueue(
    async ({ characterId }) => {
      synced.push(characterId)
      await running.promise
    },
    () => assert.fail('동기화 실패가 보고되면 안 된다')
  )
  queue.request({ serverId: 'siroco', characterId: 'first' })
  queue.request({ serverId: 'siroco', characterId: 'second' })
  const waited = queue.requestAndWait(character)

  queue.close()
  await waited
  await queue.requestAndWait({ serverId: 'siroco', characterId: 'after-close' })
  const runningWaited = settled(queue.requestAndWait({ serverId: 'siroco', characterId: 'first' }))
  await nextTurn()

  assert.deepEqual(synced, ['first', 'second'])
  assert.equal(runningWaited(), false)

  running.release()
  await nextTurn()

  assert.equal(runningWaited(), true)
})

test('타임라인 조회는 그 캐릭터의 동기화가 끝난 뒤 읽은 값을 준다', async (t) => {
  const stored: CharacterTimeline = {
    weeklyClears: [],
    seasonClears: [{ kind: 'raid', name: '디레지에 레이드', count: 3 }],
    enhancements: [],
    acquisitions: []
  }
  let synced = false
  const app = await createApiHttpApp({
    search: { searchCharacters: unused },
    details: { fetchDetails: unused, catalog: createCatalogService(unused) },
    timeline: {
      sync: async () => {
        await nextTurn()
        synced = true
      },
      read: async (requested) => {
        assert.deepEqual(requested, character)
        assert.equal(synced, true, '동기화가 끝나기 전에 읽으면 안 된다')

        return stored
      },
      close: async () => undefined
    },
    todayGrade: { fetchShopGrade: unused },
    writeAccessLog: () => undefined
  })
  t.after(() => app.close())
  await app.listen(0, '127.0.0.1')
  const origin = await app.getUrl()
  const path = `/characters/${character.serverId}/${character.characterId}/timeline`

  const response = await fetch(new URL(path, origin))

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), stored)
})

test('DB 설정이 없으면 타임라인 조회는 query와 상관없이 빈 배열을 주고 HEAD도 200으로 답하며 잘못된 캐릭터는 거절한다', async (t) => {
  const app = await createApiHttpApp({
    search: { searchCharacters: unused },
    details: { fetchDetails: unused, catalog: createCatalogService(unused) },
    todayGrade: { fetchShopGrade: unused },
    writeAccessLog: () => undefined
  })
  t.after(() => app.close())
  await app.listen(0, '127.0.0.1')
  const origin = await app.getUrl()

  const response = await fetch(new URL('/characters/siroco/synthetic/timeline', origin))
  const withQuery = await fetch(new URL('/characters/siroco/synthetic/timeline?x=1', origin))
  const head = await fetch(new URL('/characters/siroco/synthetic/timeline', origin), {
    method: 'HEAD'
  })
  const unknownServer = await fetch(new URL('/characters/unknown/synthetic/timeline', origin))

  const empty = { weeklyClears: [], seasonClears: [], enhancements: [], acquisitions: [] }
  for (const accepted of [response, withQuery]) {
    assert.equal(accepted.status, 200)
    assert.deepEqual(await accepted.json(), empty)
  }
  assert.equal(head.status, 200)
  assert.equal(unknownServer.status, 400)
  assert.equal(
    ((await unknownServer.json()) as { error: { code: string } }).error.code,
    'INVALID_CHARACTER_QUERY'
  )
})
