import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate as nextTurn } from 'node:timers/promises'
import type {
  CharacterTimelineItemRow,
  TimelineCharacter,
  TimelineEventRow
} from '@dfragon/database'
import type { INestApplication } from '@nestjs/common'
import {
  type ActivitySeasonRange,
  type AdventureActivityRead,
  emptySeasonActivity,
  findActivitySeason,
  toActivitySeasons,
  toSeasonActivity
} from '../src/adventure-guild/activity.js'
import type { AdventureGuildReader } from '../src/adventure-guild/service.js'
import { createCatalogService } from '../src/characters/catalog/service.js'
import { createApiHttpApp } from '../src/http.js'

// 합성 타임라인이다. 시즌 구간은 천해천 시작부터 가상의 다음 시즌 시작까지로 둔다.
const at = (time: string) => new Date(`${time}+09:00`)
const season: ActivitySeasonRange = {
  id: 11,
  startsAt: at('2026-03-26T06:00:00'),
  endsAt: at('2026-12-17T06:00:00')
}
const raid = (time: string, raidName: string): TimelineEventRow => ({
  code: 201,
  occurredAt: at(time),
  name: '레이드',
  raidName,
  data: {}
})
const legion = (time: string, regionName: string): TimelineEventRow => ({
  code: 209,
  occurredAt: at(time),
  name: '레기온',
  raidName: null,
  data: { regionName }
})
let nextId = 1n
function item(
  code: number,
  time: string,
  itemRarity: string | null,
  data: Record<string, unknown> = {}
): CharacterTimelineItemRow {
  return {
    serverId: 'cain',
    characterId: 'synthetic',
    id: nextId++,
    code,
    occurredAt: at(time),
    name: '합성',
    itemId: null,
    itemName: null,
    itemRarity,
    data
  }
}
const acquisition = (time: string, itemRarity: string | null, code = 505) =>
  item(code, time, itemRarity)
const enhancement = (
  code: 401 | 402 | 403,
  time: string,
  before: number | null,
  after: number,
  result: boolean
) => item(code, time, '에픽', { before, after, result, safe: false })
const activity = (records: Partial<Parameters<typeof toSeasonActivity>[1]>) =>
  toSeasonActivity(season, { clears: [], items: [], ...records })

test('하루는 06:00 KST에 바뀌어 05:59 기록은 전날로 센다', () => {
  const { days } = activity({
    clears: [raid('2026-07-18T05:59:00', '디레지에 레이드')],
    items: [acquisition('2026-07-18T06:00:00', '에픽')]
  })

  assert.deepEqual(
    days.map(({ date, raid, item }) => ({ date, raid, item })),
    [
      { date: '2026-07-17', raid: 1, item: 0 },
      { date: '2026-07-18', raid: 0, item: 1 }
    ]
  )
})

test('시즌 시작 전과 다음 시즌 시작부터의 기록은 세지 않는다', () => {
  const { summary, days } = activity({
    clears: [
      legion('2026-03-26T05:59:00', '아포칼립스'),
      legion('2026-03-26T06:00:00', '아포칼립스'),
      legion('2026-12-17T05:59:00', '아포칼립스'),
      legion('2026-12-17T06:00:00', '아포칼립스')
    ],
    items: [enhancement(401, '2026-12-17T06:00:00', 5, 6, true)]
  })

  assert.deepEqual(summary.legions, [{ name: '아포칼립스', count: 2 }])
  assert.equal(summary.enhancement.attempts, 0)
  assert.deepEqual(
    days.map(({ date }) => date),
    ['2026-03-26', '2026-12-16']
  )
})

test('지금 시즌은 끝이 없어 시작 뒤 기록을 모두 센다', () => {
  const current = toSeasonActivity(
    { ...season, endsAt: null },
    { clears: [legion('2027-01-01T12:00:00', '아포칼립스')], items: [] }
  )

  assert.deepEqual(current.summary.legions, [{ name: '아포칼립스', count: 1 }])
})

test('레이드와 레기온은 이름별로 많은 순으로 센다', () => {
  const { summary } = activity({
    clears: [
      raid('2026-07-18T12:00:00', '무너진 성자 미카엘라'),
      raid('2026-07-18T13:00:00', '디레지에 레이드'),
      raid('2026-07-19T12:00:00', '디레지에 레이드'),
      legion('2026-07-18T14:00:00', '아포칼립스'),
      { ...legion('2026-07-18T15:00:00', '아포칼립스'), data: {} }
    ]
  })

  assert.deepEqual(summary.raids, [
    { name: '디레지에 레이드', count: 2 },
    { name: '무너진 성자 미카엘라', count: 1 }
  ])
  assert.deepEqual(summary.legions, [{ name: '아포칼립스', count: 1 }])
})

test('아이템은 획득 코드의 레전더리, 에픽, 태초, 신화만 등급별로 세고 태초, 신화를 얻은 날을 표시한다', () => {
  const { summary, days } = activity({
    items: [
      acquisition('2026-07-18T12:00:00', '레전더리'),
      acquisition('2026-07-18T12:01:00', '에픽'),
      acquisition('2026-07-18T12:02:00', '태초'),
      acquisition('2026-07-19T12:00:00', '신화', 513),
      acquisition('2026-07-19T12:01:00', '레어', 554),
      acquisition('2026-07-19T12:02:00', null, 501),
      acquisition('2026-07-20T12:00:00', '레전더리', 557)
    ]
  })

  assert.deepEqual(summary.items, { legendary: 2, epic: 1, primeval: 1, mythic: 1 })
  assert.deepEqual(
    days.map(({ date, item, primeval, mythic }) => ({ date, item, primeval, mythic })),
    [
      { date: '2026-07-18', item: 3, primeval: true, mythic: false },
      { date: '2026-07-19', item: 1, primeval: false, mythic: true },
      { date: '2026-07-20', item: 1, primeval: false, mythic: false }
    ]
  )
})

test('강화 단계는 before + 1이 아니라 after로 세고 성공을 따로 센다', () => {
  const { summary } = activity({
    items: [
      enhancement(402, '2026-07-18T12:00:00', 12, 13, false),
      enhancement(402, '2026-07-18T12:01:00', 0, 12, false),
      enhancement(402, '2026-07-18T12:02:00', 11, 12, true),
      enhancement(401, '2026-07-18T12:03:00', 0, 13, true),
      enhancement(401, '2026-07-18T12:04:00', 14, 15, false)
    ]
  })

  assert.deepEqual(summary.enhancement.amplify, [
    { target: 12, attempts: 2, successes: 1 },
    { target: 13, attempts: 1, successes: 0 }
  ])
  assert.deepEqual(summary.enhancement.reinforce, [
    { target: 13, attempts: 1, successes: 1 },
    { target: 15, attempts: 1, successes: 0 }
  ])
})

test('10증폭, 12강부터 단계별로 넣고 그 아래와 재련은 횟수만 센다', () => {
  const { summary, days } = activity({
    items: [
      enhancement(402, '2026-07-18T12:00:00', 8, 9, true),
      enhancement(401, '2026-07-18T12:01:00', 10, 11, true),
      enhancement(403, '2026-07-18T12:02:00', null, 8, true),
      enhancement(402, '2026-07-19T12:00:00', 9, 10, false),
      enhancement(401, '2026-07-20T12:00:00', 11, 12, false)
    ]
  })

  assert.deepEqual(summary.enhancement, {
    attempts: 5,
    amplify: [{ target: 10, attempts: 1, successes: 0 }],
    reinforce: [{ target: 12, attempts: 1, successes: 0 }],
    amplifyBelow10: 1,
    reinforceBelow12: 1,
    refine: 1
  })
  assert.deepEqual(
    days.map(({ date, enhance, highEnhancement }) => ({ date, enhance, highEnhancement })),
    [
      { date: '2026-07-18', enhance: 3, highEnhancement: false },
      { date: '2026-07-19', enhance: 1, highEnhancement: true },
      { date: '2026-07-20', enhance: 1, highEnhancement: true }
    ]
  )
})

test('시즌 목록은 시작한 시즌만 두고 중천부터 available이며, 시즌을 고르지 않으면 지금 시즌이다', () => {
  const now = at('2026-11-07T12:00:00')
  const seasons = toActivitySeasons(
    [
      { id: 9, name: '선계', startsAt: at('2023-09-14T06:00:00') },
      { id: 10, name: '중천', startsAt: at('2025-01-09T06:00:00') },
      { id: 11, name: '천해천', startsAt: at('2026-03-26T06:00:00') },
      { id: 12, name: '합성 다음 시즌', startsAt: at('2026-12-17T06:00:00') }
    ],
    now
  )

  assert.deepEqual(
    seasons.map(({ id, available }) => [id, available]),
    [
      [9, false],
      [10, true],
      [11, true]
    ]
  )
  assert.deepEqual(findActivitySeason(seasons, undefined), {
    id: 11,
    startsAt: at('2026-03-26T06:00:00'),
    endsAt: null
  })
  assert.deepEqual(findActivitySeason(seasons, 10), {
    id: 10,
    startsAt: at('2025-01-09T06:00:00'),
    endsAt: at('2026-03-26T06:00:00')
  })
  assert.equal(findActivitySeason(seasons, 12), undefined)
  assert.equal(findActivitySeason([], undefined), undefined)
})

async function listen(
  readAdventureActivity: AdventureGuildReader['readAdventureActivity'],
  syncTimeline: (character: TimelineCharacter) => Promise<void>
): Promise<{ app: INestApplication; origin: string }> {
  const unused = async (): Promise<never> => assert.fail('Neople을 부르면 안 된다')
  const app = await createApiHttpApp({
    search: { searchCharacters: unused },
    details: { fetchDetails: unused, catalog: createCatalogService(unused) },
    todayGrade: { fetchShopGrade: unused },
    adventureGuild: {
      readAdventureCharacters: unused,
      readGuild: unused,
      readAdventureWeeklyClears: unused,
      readAdventureActivity
    },
    timeline: {
      sync: syncTimeline,
      read: unused,
      readPage: unused,
      backfillEnhancements: unused,
      close: async () => undefined
    },
    writeAccessLog: () => undefined
  })
  await app.listen(0, '127.0.0.1')

  return { app, origin: await app.getUrl() }
}

const activityRead: AdventureActivityRead = {
  characters: [
    { serverId: 'cain', characterId: 'a' },
    { serverId: 'siroco', characterId: 'b' }
  ],
  activity: {
    seasons: [{ id: 11, name: '천해천', startsAt: season.startsAt, available: true }],
    season: { ...season, endsAt: null },
    ...emptySeasonActivity()
  }
}

test('시즌 활동 조회는 고른 시즌을 넘기고 캐릭터마다 동기화를 요청하되 끝나기를 기다리지 않는다', async () => {
  const reads: [string, number | undefined][] = []
  const requested: TimelineCharacter[] = []
  let release!: () => void
  const syncing = new Promise<void>((resolve) => {
    release = resolve
  })
  const { app, origin } = await listen(
    async (adventureName, seasonId) => {
      reads.push([adventureName, seasonId])

      return activityRead
    },
    (character) => {
      requested.push(character)

      return syncing
    }
  )
  try {
    const name = encodeURIComponent('합성 모험단')
    const current = await fetch(new URL(`/adventures/${name}/activity`, origin))
    const chosen = await fetch(new URL(`/adventures/${name}/activity?season=10`, origin))

    assert.equal(current.status, 200)
    assert.equal(chosen.status, 200)
    assert.deepEqual(await current.json(), {
      seasons: [{ id: 11, name: '천해천', startsAt: '2026-03-25T21:00:00.000Z', available: true }],
      season: { id: 11, startsAt: '2026-03-25T21:00:00.000Z', endsAt: null },
      ...emptySeasonActivity()
    })
    assert.deepEqual(reads, [
      ['합성 모험단', undefined],
      ['합성 모험단', 10]
    ])
    release()
    while (requested.length < 2) {
      await nextTurn()
    }
    assert.deepEqual(requested.slice(0, 2), activityRead.characters)
  } finally {
    release()
    await app.close()
  }
})

test('시즌 번호가 정수가 아니거나 없는 시즌이면 400 INVALID_CHARACTER_QUERY를 준다', async () => {
  const reads: (number | undefined)[] = []
  const { app, origin } = await listen(
    async (_adventureName, seasonId) => {
      reads.push(seasonId)

      return undefined
    },
    async () => undefined
  )
  try {
    for (const query of [
      'season=',
      'season=0',
      'season=1.5',
      'season=abc',
      'season=11&season=10',
      'season=99'
    ]) {
      const response = await fetch(new URL(`/adventures/a/activity?${query}`, origin))
      const body = await response.json()

      assert.equal(response.status, 400, query)
      assert.equal(body.error.code, 'INVALID_CHARACTER_QUERY', query)
    }
    assert.deepEqual(reads, [99])
  } finally {
    await app.close()
  }
})
