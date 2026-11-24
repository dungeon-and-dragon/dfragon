import assert from 'node:assert/strict'
import test from 'node:test'
import type { SeasonBackfillState, TimelineCharacter, TimelineRange } from '@dfragon/database'
import type { HttpAppHandle } from '@dfragon/http-server'
import {
  type AdventureSeasonBackfillRead,
  type AdventureGuildRepository
} from '../src/application/adventure-guild/repository.js'
import {
  type StoredActivitySeason,
  emptySeasonActivity,
  toActivitySeasons,
  toSeasonBackfillRanges,
  withSeasonBackfills
} from '../src/domain/adventure-guild/activity.js'
import { CatalogService } from '@dfragon/server-core/application/character-catalog/index.js'
import {
  toSeasonBackfillJobs,
  toSeasonBackfillProgress
} from '../src/domain/character-timeline/season-backfill.js'
import { createApiHttpApp } from '../src/runtime/api-app.js'
import type { TimelineSyncRequestRepository } from '../src/application/character-timeline/repository.js'
import { memoryTimelineRequests } from './timeline-request-fixtures.js'

// 시즌 시작은 운영 DB seasons 표와 같은 값이고, 캐릭터와 타임라인은 합성이다.
const at = (time: string) => new Date(`${time}+09:00`)
const MINUTE_MS = 60_000
const storedSeasons = [
  { id: 5, name: '마계', startsAt: at('2016-09-01T06:00:00') },
  { id: 6, name: '할렘', startsAt: at('2018-08-09T06:00:00') },
  { id: 7, name: '귀환', startsAt: at('2020-01-09T06:00:00') },
  { id: 8, name: 'THE NEXT JOURNEY', startsAt: at('2022-03-17T06:00:00') },
  { id: 9, name: '선계', startsAt: at('2023-09-14T06:00:00') },
  { id: 10, name: '중천', startsAt: at('2025-01-09T06:00:00') },
  { id: 11, name: '천해천', startsAt: at('2026-03-26T06:00:00') }
]
const seasons = toActivitySeasons(storedSeasons, at('2026-11-07T12:00:00'))
const ranges = toSeasonBackfillRanges(seasons)
const character = { serverId: 'cain', characterId: 'season-backfill' }
const other = { serverId: 'siroco', characterId: 'season-backfill-other' }

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

test('옛 시즌 구간은 시즌 시작부터 다음 시즌 시작 직전 분까지이고 캐릭터당 90일 구간 수는 시즌마다 정한 값이다', () => {
  assert.deepEqual([...ranges.keys()], [5, 6, 7, 8, 9])
  assert.deepEqual(seasonRange(7), {
    start: at('2020-01-09T06:00:00'),
    end: at('2022-03-17T05:59:00')
  })
  // 선계 끝이 중천 정기 동기화가 받기 시작하는 06:00과 겹치지 않는다.
  assert.equal(seasonRange(9).end.getTime(), at('2025-01-09T06:00:00').getTime() - MINUTE_MS)
  assert.deepEqual(
    [...ranges].map(([seasonId, range]) => [
      seasonId,
      toSeasonBackfillProgress(range, 1, []).total
    ]),
    [
      [5, 4],
      [6, 6],
      [7, 9],
      [8, 7],
      [9, 6]
    ]
  )
})

test('마계는 시즌 시작이 아니라 Neople이 타임라인을 주는 2017-09-21 00:00부터 받는다', () => {
  assert.deepEqual(seasonRange(5), {
    start: at('2017-09-21T00:00:00'),
    end: at('2018-08-09T05:59:00')
  })
})

test('진행률은 캐릭터들의 구간 수를 더하고, 받은 위치까지 끝난 구간만 받은 것으로 센다', () => {
  // 귀환은 캐릭터당 9구간이고 첫 구간은 2020-04-07 05:59에 끝난다.
  const range = seasonRange(7)
  const firstRangeEnd = at('2020-04-07T05:59:00')

  assert.deepEqual(toSeasonBackfillProgress(range, 3, []), { done: 0, total: 27 })
  assert.deepEqual(
    toSeasonBackfillProgress(range, 3, [
      state(character, firstRangeEnd),
      state(other, range.end, at('2026-11-07T00:00:00'))
    ]),
    { done: 10, total: 27 }
  )
  assert.deepEqual(
    toSeasonBackfillProgress(range, 3, [state(character, new Date(firstRangeEnd.getTime() - 1))]),
    { done: 0, total: 27 }
  )
})

test('모든 캐릭터가 끝까지 받은 옛 시즌만 available이고 진행률이 없는 시즌은 그대로 둔다', () => {
  const full = { done: 9, total: 9 }
  const partial = { done: 3, total: 9 }
  const empty = { done: 0, total: 0 }
  const available = withSeasonBackfills(
    seasons,
    new Map([
      [7, full],
      [8, partial],
      [9, empty]
    ])
  ).map(({ id, available, backfill }) => [id, available, backfill])

  assert.deepEqual(available, [
    [5, false, undefined],
    [6, false, undefined],
    [7, true, full],
    [8, false, partial],
    [9, false, empty],
    [10, true, undefined],
    [11, true, undefined]
  ])
})

test('끝까지 받은 캐릭터는 받기 대상에서 빼고, 받는 중이던 캐릭터와 처음 받는 캐릭터는 넣는다', () => {
  const range = seasonRange(9)
  const fresh = { serverId: 'bakal', characterId: 'season-backfill-fresh' }
  // 모험단 캐릭터 행은 서버, 캐릭터 id 밖의 칸도 있어 job에는 두 칸만 남는지 본다.
  const characters = [
    { ...character, characterName: '합성' },
    { ...other, characterName: '합성다른' },
    { ...fresh, characterName: '합성처음' }
  ]
  const jobs = toSeasonBackfillJobs(characters, 9, range, [
    state(character, range.end, at('2026-11-07T00:00:00')),
    state(other, range.start)
  ])

  assert.deepEqual(jobs, [
    { character: other, seasonId: 9, range },
    { character: fresh, seasonId: 9, range }
  ])
})

async function listen(
  reader: Pick<AdventureGuildRepository, 'readAdventureSeasonBackfill' | 'readAdventureActivity'>,
  requests: TimelineSyncRequestRepository
): Promise<{ app: HttpAppHandle; origin: string }> {
  const unused = async (): Promise<never> => assert.fail('부르면 안 된다')
  const { app } = await createApiHttpApp({
    search: { searchCharacters: unused },
    details: { fetchDetails: unused, catalog: new CatalogService(unused) },
    todayGrade: { fetchShopGrade: unused },
    adventureGuild: {
      readAdventureCharacters: unused,
      readGuild: unused,
      readAdventureWeeklyClears: unused,
      readAdventureEquipment: unused,
      readAdventureTimeline: unused,
      readAdventureSeasonDays: unused,
      ...reader
    },
    timeline: {
      read: unused,
      readPage: unused,
      requests,
      close: async () => undefined
    },
    writeAccessLog: () => undefined
  })
  await app.listen(0, '127.0.0.1')

  return { app, origin: await app.getUrl() }
}

const backfillSeasonView: StoredActivitySeason = {
  ...storedSeasons[4]!,
  available: false,
  backfill: { done: 0, total: 12 }
}

function backfillRead(): AdventureSeasonBackfillRead {
  return {
    characters: [character, other],
    season: backfillSeasonView,
    jobs: [character, other].map((requested) => ({
      character: requested,
      seasonId: 9,
      range: seasonRange(9)
    }))
  }
}

test('옛 시즌 받기 요청은 받기를 기다리지 않고 캐릭터마다 요청을 넣은 뒤 진행률을 주며, 요청 행이 없어지면 running이 false이다', async (t) => {
  const requests = memoryTimelineRequests()
  const reads: [string, number][] = []
  const { app, origin } = await listen(
    {
      readAdventureSeasonBackfill: async (adventureName, seasonId) => {
        reads.push([adventureName, seasonId])

        return backfillRead()
      },
      readAdventureActivity: async () => ({
        characters: [character, other],
        activity: {
          seasons: [backfillSeasonView, { ...storedSeasons[5]!, available: true }],
          season: null,
          ...emptySeasonActivity()
        }
      })
    },
    requests.repository
  )
  t.after(() => app.close())
  const path = `/adventures/${encodeURIComponent('합성 모험단')}/activity/seasons/9/backfill`
  const activityPath = `/adventures/${encodeURIComponent('합성 모험단')}/activity`

  const first = await fetch(new URL(path, origin), { method: 'POST' })
  const second = await fetch(new URL(path, origin), { method: 'POST' })
  const activity = await fetch(new URL(activityPath, origin))

  const expected = {
    id: 9,
    name: '선계',
    startsAt: '2023-09-13T21:00:00.000Z',
    available: false,
    backfill: { done: 0, total: 12, running: true }
  }
  assert.equal(first.status, 200)
  assert.deepEqual(await first.json(), expected)
  assert.deepEqual(await second.json(), expected)
  assert.deepEqual(reads, [
    ['합성 모험단', 9],
    ['합성 모험단', 9]
  ])
  // 시즌 활동 조회는 캐릭터마다 정기 동기화도 넣어, 옛 시즌 받기 행만 본다.
  assert.deepEqual(
    requests.keys().filter((key) => key.startsWith('season-backfill/')),
    ['season-backfill/cain/season-backfill/9', 'season-backfill/siroco/season-backfill-other/9']
  )
  assert.deepEqual((await activity.json()).seasons, [
    expected,
    { id: 10, name: '중천', startsAt: '2025-01-08T21:00:00.000Z', available: true }
  ])

  for (const requested of [character, other]) {
    requests.remove({ kind: 'season-backfill', ...requested, seasonId: 9 })
  }
  const done = await fetch(new URL(activityPath, origin))

  assert.equal((await done.json()).seasons[0].backfill.running, false)
})

test('받을 캐릭터가 없으면 running이 false이다', async (t) => {
  const { app, origin } = await listen(
    {
      readAdventureSeasonBackfill: async () => ({
        characters: [character],
        season: { ...backfillSeasonView, available: true, backfill: { done: 6, total: 6 } },
        jobs: []
      }),
      readAdventureActivity: async () => assert.fail('시즌 활동을 읽으면 안 된다')
    },
    memoryTimelineRequests().repository
  )
  t.after(() => app.close())

  const response = await fetch(new URL('/adventures/a/activity/seasons/9/backfill', origin), {
    method: 'POST'
  })

  assert.equal(response.status, 200)
  assert.deepEqual((await response.json()).backfill, { done: 6, total: 6, running: false })
})

test('옛 시즌 받기의 시즌 번호가 정수가 아니거나 받을 수 없는 시즌이면 400 INVALID_CHARACTER_QUERY를 준다', async (t) => {
  const reads: number[] = []
  const { app, origin } = await listen(
    {
      readAdventureSeasonBackfill: async (_adventureName, seasonId) => {
        reads.push(seasonId)

        return undefined
      },
      readAdventureActivity: async () => assert.fail('시즌 활동을 읽으면 안 된다')
    },
    memoryTimelineRequests().repository
  )
  t.after(() => app.close())

  for (const season of ['0', '1.5', 'abc', '10']) {
    const response = await fetch(
      new URL(`/adventures/a/activity/seasons/${season}/backfill`, origin),
      { method: 'POST' }
    )

    assert.equal(response.status, 400, season)
    assert.equal((await response.json()).error.code, 'INVALID_CHARACTER_QUERY', season)
  }
  assert.deepEqual(reads, [10])
})
