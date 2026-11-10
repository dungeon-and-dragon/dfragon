import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate as nextTurn } from 'node:timers/promises'
import type { TimelineEventRow, TimelineItemRow } from '@dfragon/database'
import { createCatalogService } from '../src/application/character-catalog/service.js'
import { createTimelineSyncQueue } from '../src/characters/timeline/queue.js'
import {
  type CharacterTimeline,
  EMPTY_CHARACTER_TIMELINE,
  formatTimelineCursor,
  parseTimelineCursor,
  toCharacterTimeline
} from '../src/characters/timeline/read.js'
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
    id: 1n,
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

test('레이드는 raid_name, 레기온은 regionName을 이름으로 쓰고 시즌 클리어는 종류, 이름, 하드 여부별로 센다', () => {
  const weekStart = new Date('2026-11-05T06:00:00+09:00')
  const seasonStart = new Date('2026-03-26T06:00:00+09:00')
  const raid = { raidName: '나벨 레이드', data: { modeName: '나벨 : 무지의 악' } }
  const hardRaid = { raidName: '나벨 레이드', data: { modeName: '나벨 : 무지의 악', hard: true } }
  const timeline = toCharacterTimeline(
    {
      clears: [
        event({ code: 201, occurredAt: new Date('2026-03-26T05:59:00+09:00'), ...raid }),
        event({ code: 201, occurredAt: new Date('2026-11-05T05:58:00+09:00'), ...raid }),
        event({ code: 201, occurredAt: new Date('2026-11-05T05:59:00+09:00'), ...hardRaid }),
        event({ code: 201, occurredAt: weekStart, ...hardRaid }),
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
    {
      kind: 'raid',
      name: '나벨 레이드',
      modeName: '나벨 : 무지의 악',
      hard: true,
      occurredAt: weekStart
    },
    {
      kind: 'raid',
      name: '이내 황혼전',
      modeName: null,
      hard: false,
      occurredAt: new Date('2026-11-05T08:00:00+09:00')
    },
    {
      kind: 'legion',
      name: '베누스',
      modeName: null,
      hard: false,
      occurredAt: new Date('2026-11-05T09:00:00+09:00')
    }
  ])
  assert.deepEqual(timeline.seasonClears, [
    { kind: 'raid', name: '나벨 레이드', hard: false, count: 1 },
    { kind: 'raid', name: '나벨 레이드', hard: true, count: 2 },
    { kind: 'raid', name: '이내 황혼전', hard: false, count: 1 },
    { kind: 'legion', name: '베누스', hard: false, count: 1 }
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

test('형식이 다른 선택 필드는 null이나 false로 두고 이름, after, result가 맞지 않는 행은 뺀다', () => {
  const occurredAt = new Date('2026-11-05T12:00:00+09:00')
  const timeline = toCharacterTimeline(
    {
      clears: [
        event({ code: 201, raidName: '디레지에 레이드', data: { modeName: 3, hard: 'true' } }),
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
    { kind: 'raid', name: '디레지에 레이드', modeName: null, hard: false, occurredAt }
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

test('기다리는 요청은 그 캐릭터의 진행 중인 동기화가 끝난 뒤 풀리고 같은 동기화를 함께 기다린다', async () => {
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
  const waited = settled(queue.requestAndWait(character))
  const waitedAgain = settled(queue.requestAndWait(character))
  await nextTurn()

  assert.deepEqual(synced, ['first', 'second', character.characterId])
  assert.equal(waited(), false)

  gates.get('first')!.release()
  await nextTurn()

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

// 닫은 뒤 온 요청이 동기화를 기다리게 바뀌면 멈추지 않고 실패하도록 timeout을 둔다.
test('queue를 닫으면 닫은 뒤 온 요청은 동기화 없이 풀리고 진행 중인 동기화는 끝을 기다린다', {
  timeout: 10_000
}, async () => {
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

  queue.close()
  await queue.requestAndWait(character)
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
    ...EMPTY_CHARACTER_TIMELINE,
    seasonClears: [{ kind: 'raid', name: '디레지에 레이드', hard: true, count: 3 }],
    enhancementsCursor: '1762311600000.42'
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
      readPage: unused,
      backfillEnhancements: unused,
      backfillSeason: unused,
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

test('DB 설정이 없으면 타임라인 조회는 query와 상관없이 빈 배열을, 이어 받기는 빈 목록을 주고 HEAD도 200으로 답하며 잘못된 캐릭터는 거절한다', async (t) => {
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
  const page = await fetch(
    new URL('/characters/siroco/synthetic/timeline/enhancements?before=1.1', origin)
  )

  assert.equal(page.status, 200)
  assert.deepEqual(await page.json(), { items: [], nextCursor: null })
  const empty = {
    weeklyClears: [],
    seasonClears: [],
    enhancements: [],
    enhancementsCursor: null,
    acquisitions: [],
    acquisitionsCursor: null
  }
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

test('강화, 획득은 최근 50개를 주고, 더 있으면 50번째 행을 가리키는 cursor를, 없으면 null을 준다', () => {
  const now = new Date('2026-11-05T12:00:00+09:00')
  const rows = (count: number, code: number, data: Record<string, unknown> = {}) =>
    Array.from({ length: count }, (_, index) =>
      item({
        id: BigInt(1000 - index),
        code,
        data,
        occurredAt: new Date(now.getTime() - index * 60_000)
      })
    )
  const acquisitions = rows(51, 505)
  const timeline = toCharacterTimeline(
    {
      clears: [],
      enhancements: rows(50, 401, { after: 10, result: true }),
      acquisitions
    },
    now,
    now
  )

  assert.equal(timeline.enhancements.length, 50)
  assert.equal(timeline.enhancementsCursor, null)
  assert.deepEqual(
    timeline.acquisitions.map(({ occurredAt }) => occurredAt),
    acquisitions.slice(0, 50).map(({ occurredAt }) => occurredAt)
  )
  assert.deepEqual(parseTimelineCursor(timeline.acquisitionsCursor!), {
    occurredAt: acquisitions[49]!.occurredAt,
    id: acquisitions[49]!.id
  })
})

test('cursor는 시각과 id를 그대로 되돌리고 형식이 다르거나 bigint를 넘을 수 있는 값은 읽지 않는다', () => {
  const cursor = { occurredAt: new Date('2017-09-21T00:00:00.123+09:00'), id: 987654321012345678n }

  assert.deepEqual(parseTimelineCursor(formatTimelineCursor(cursor)), cursor)
  for (const invalid of [
    '',
    'abc',
    '1',
    '1.',
    '.1',
    '-1.1',
    '1.-1',
    '1.1.1',
    '1.5e3',
    '1.9223372036854775808',
    '1234567890123456.1'
  ]) {
    assert.equal(parseTimelineCursor(invalid), undefined, invalid)
  }
})

test('이어 받기는 동기화를 기다리지 않고 before의 cursor로 목록을 읽고, before가 없거나 잘못됐거나 다른 query가 있으면 400으로 거절한다', async (t) => {
  const stored = {
    items: [
      {
        code: 505,
        name: '아이템 획득(던전 드랍)',
        itemId: 'synthetic-item',
        itemName: '합성 아이템',
        itemRarity: '에픽',
        occurredAt: new Date('2026-11-05T12:00:00+09:00')
      }
    ],
    nextCursor: '1762311600000.7'
  }
  const reads: unknown[] = []
  const app = await createApiHttpApp({
    search: { searchCharacters: unused },
    details: { fetchDetails: unused, catalog: createCatalogService(unused) },
    timeline: {
      sync: unused,
      read: unused,
      readPage: async (requested, list, before) => {
        reads.push({ requested, list, before })

        return stored
      },
      backfillEnhancements: unused,
      backfillSeason: unused,
      close: async () => undefined
    },
    todayGrade: { fetchShopGrade: unused },
    writeAccessLog: () => undefined
  })
  t.after(() => app.close())
  await app.listen(0, '127.0.0.1')
  const origin = await app.getUrl()
  const path = `/characters/${character.serverId}/${character.characterId}/timeline`

  const enhancements = await fetch(new URL(`${path}/enhancements?before=1762311600000.42`, origin))
  const acquisitions = await fetch(new URL(`${path}/acquisitions?before=1762311600000.43`, origin))

  for (const response of [enhancements, acquisitions]) {
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      ...stored,
      items: [{ ...stored.items[0], occurredAt: '2026-11-05T03:00:00.000Z' }]
    })
  }
  const occurredAt = new Date(1762311600000)
  assert.deepEqual(reads, [
    { requested: character, list: 'enhancements', before: { occurredAt, id: 42n } },
    { requested: character, list: 'acquisitions', before: { occurredAt, id: 43n } }
  ])

  for (const query of [
    '',
    '?before=',
    '?before=abc',
    '?before=1.2&x=1',
    '?before=1.2&before=1.3'
  ]) {
    const rejected = await fetch(new URL(`${path}/enhancements${query}`, origin))

    assert.equal(rejected.status, 400, query)
    assert.equal(
      ((await rejected.json()) as { error: { code: string } }).error.code,
      'INVALID_CHARACTER_QUERY'
    )
  }
  assert.equal(reads.length, 2)
})
