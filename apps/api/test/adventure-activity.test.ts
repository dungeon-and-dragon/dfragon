import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate as nextTurn } from 'node:timers/promises'
import type {
  CharacterTimelineItemRow,
  DatabaseClient,
  TimelineCharacter,
  TimelineEventRow
} from '@dfragon/database'
import type { INestApplication } from '@nestjs/common'
import {
  type ActivitySeasonRange,
  type AdventureActivityRead,
  emptySeasonActivity,
  findActivitySeason,
  readAdventureSeasonDays,
  toActivityDayDetail,
  toActivityDayRange,
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
  endsAt: at('2026-12-17T06:00:00'),
  timelineStartsAt: at('2026-03-26T06:00:00')
}
const raid = (time: string, raidName: string): TimelineEventRow => ({
  code: 201,
  occurredAt: at(time),
  name: '레이드',
  raidName,
  data: {}
})
const hardRaid = (time: string, raidName: string): TimelineEventRow => ({
  ...raid(time, raidName),
  data: { hard: true }
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
  result: boolean,
  ticket?: Record<string, unknown> | null
) => item(code, time, '에픽', { before, after, result, safe: false, ticket })
// 운영 DB의 data.ticket은 객체지만 안의 키는 확인하지 못해 합성 키를 쓴다.
const ticketItem = (name: string) => ({ name })
const activity = (records: Partial<Parameters<typeof toSeasonActivity>[1]>) =>
  toSeasonActivity(season, { clears: [], items: [], ...records })
const day = (date: string) => {
  const range = toActivityDayRange(date)
  assert.ok(range, date)

  return range
}

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

test('레이드와 레기온은 이름별로 세어 횟수와 관계없이 출시가 최근인 것부터 둔다', () => {
  const { summary } = activity({
    clears: [
      raid('2026-07-18T12:00:00', '프레이-이시스'),
      raid('2026-07-18T13:00:00', '이내 황혼전'),
      raid('2026-07-18T14:00:00', '혼돈의 오즈마'),
      raid('2026-07-19T12:00:00', '혼돈의 오즈마'),
      legion('2026-07-18T14:00:00', '베누스'),
      legion('2026-07-18T15:00:00', '베누스'),
      legion('2026-07-18T16:00:00', '깨어난 숲(일반)'),
      legion('2026-07-18T17:00:00', '깨어난 숲(일반)'),
      legion('2026-07-18T18:00:00', '깨어난 숲(극)'),
      legion('2026-07-18T19:00:00', '아포칼립스'),
      { ...legion('2026-07-18T20:00:00', '아포칼립스'), data: {} }
    ]
  })

  assert.deepEqual(summary.raids, [
    { name: '이내 황혼전', count: 1, hard: 0, normal: 1 },
    { name: '혼돈의 오즈마', count: 2, hard: 0, normal: 2 },
    { name: '프레이-이시스', count: 1, hard: 0, normal: 1 }
  ])
  assert.deepEqual(summary.legions, [
    { name: '아포칼립스', count: 1 },
    { name: '베누스', count: 2 },
    { name: '깨어난 숲(극)', count: 1 },
    { name: '깨어난 숲(일반)', count: 2 }
  ])
})

test('출시 순서 표에 없는 이름은 표에 있는 이름 뒤에 많은 순, 같으면 이름 순으로 둔다', () => {
  const { summary } = activity({
    clears: [
      raid('2026-07-18T12:00:00', '합성 레이드 가'),
      raid('2026-07-18T13:00:00', '합성 레이드 다'),
      raid('2026-07-18T14:00:00', '합성 레이드 다'),
      raid('2026-07-18T15:00:00', '합성 레이드 나'),
      raid('2026-07-18T16:00:00', '합성 레이드 나'),
      raid('2026-07-18T17:00:00', '프레이-이시스'),
      raid('2026-07-18T17:10:00', '안톤'),
      raid('2026-07-18T17:20:00', '루크'),
      raid('2026-07-18T17:30:00', '루크'),
      legion('2026-07-18T18:00:00', '합성 레기온'),
      legion('2026-07-18T19:00:00', '합성 레기온'),
      legion('2026-07-18T20:00:00', '이스핀즈')
    ]
  })

  assert.deepEqual(
    summary.raids.map(({ name }) => name),
    ['프레이-이시스', '루크', '안톤', '합성 레이드 나', '합성 레이드 다', '합성 레이드 가']
  )
  assert.deepEqual(
    summary.legions.map(({ name }) => name),
    ['이스핀즈', '합성 레기온']
  )
})

test('레이드는 data.hard가 true인 클리어를 하드, 나머지를 노말로 세고 count는 둘의 합이다', () => {
  const { summary } = activity({
    clears: [
      hardRaid('2026-07-18T12:00:00', '혼돈의 오즈마'),
      hardRaid('2026-07-18T13:00:00', '혼돈의 오즈마'),
      raid('2026-07-19T12:00:00', '혼돈의 오즈마'),
      { ...raid('2026-07-19T13:00:00', '이내 황혼전'), data: { hard: false } },
      hardRaid('2026-07-20T12:00:00', '무형의 시로코')
    ]
  })

  assert.deepEqual(summary.raids, [
    { name: '이내 황혼전', count: 1, hard: 0, normal: 1 },
    { name: '혼돈의 오즈마', count: 3, hard: 2, normal: 1 },
    { name: '무형의 시로코', count: 1, hard: 1, normal: 0 }
  ])
})

test('modeName이 있는 레이드는 개전, 매칭 같은 단계와 본 레이드의 하드, 일반으로 나눠 센다', () => {
  const stage = (
    time: string,
    raidName: string,
    data: Record<string, unknown>
  ): TimelineEventRow => ({
    ...raid(time, raidName),
    data
  })
  const { summary } = activity({
    clears: [
      stage('2026-07-18T12:00:00', '기계 혁명', { modeName: '개전' }),
      stage('2026-07-18T13:00:00', '기계 혁명', { modeName: '바칼 레이드', hard: true }),
      stage('2026-07-18T14:00:00', '기계 혁명', { modeName: '바칼 레이드' }),
      stage('2026-07-18T15:00:00', '아스라한', { modeName: '무의 장막', hard: true }),
      stage('2026-07-18T16:00:00', '디레지에 레이드', { modeName: '디레지에 : 서막' }),
      stage('2026-07-18T17:00:00', '디레지에 레이드', { modeName: '디레지에 : 악연', hard: true }),
      stage('2026-07-18T18:00:00', '디레지에 레이드', { modeName: '디레지에 : 종막' }),
      stage('2026-07-18T19:00:00', '무너진 성자 미카엘라', {
        modeName: '미카엘라 : 종언서(하드)',
        hard: true
      }),
      stage('2026-07-18T20:00:00', '무너진 성자 미카엘라', { modeName: '미카엘라 : 종언서' }),
      stage('2026-07-18T21:00:00', '무너진 성자 미카엘라', { modeName: '미카엘라 : 균열서' }),
      hardRaid('2026-07-18T22:00:00', '무형의 시로코'),
      raid('2026-07-18T23:00:00', '무형의 시로코')
    ]
  })

  assert.deepEqual(summary.raids, [
    { name: '무너진 성자 미카엘라 (하드)', count: 1, hard: 1, normal: 0 },
    { name: '무너진 성자 미카엘라 (일반)', count: 1, hard: 0, normal: 1 },
    { name: '무너진 성자 미카엘라 (싱글/매칭)', count: 1, hard: 0, normal: 1 },
    { name: '디레지에 레이드 (하드)', count: 1, hard: 1, normal: 0 },
    { name: '디레지에 레이드 (일반)', count: 1, hard: 0, normal: 1 },
    { name: '디레지에 레이드 (매칭)', count: 1, hard: 0, normal: 1 },
    { name: '아스라한 (개전)', count: 1, hard: 1, normal: 0 },
    { name: '기계 혁명 (하드)', count: 1, hard: 1, normal: 0 },
    { name: '기계 혁명 (일반)', count: 1, hard: 0, normal: 1 },
    { name: '기계 혁명 (개전)', count: 1, hard: 0, normal: 1 },
    { name: '무형의 시로코', count: 2, hard: 1, normal: 1 }
  ])
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

test('강화권, 증폭권 기록은 단계별 시도와 성공에서 빼고 전체 횟수와 날짜별 값에는 센다', () => {
  const items = [
    enhancement(402, '2026-07-18T12:00:00', 0, 12, false, ticketItem('1프로 +12 장비 증폭권')),
    enhancement(402, '2026-07-18T12:01:00', 3, 12, true, ticketItem('+12 장비 증폭권[골고라이언]')),
    enhancement(401, '2026-07-18T12:02:00', 0, 13, true, ticketItem('100프로 +13 무기 강화권')),
    enhancement(402, '2026-07-19T12:00:00', 11, 12, true),
    enhancement(402, '2026-07-19T12:01:00', 11, 12, false, null)
  ]
  const { summary, days } = activity({ items })

  assert.deepEqual(summary.enhancement, {
    attempts: 5,
    amplify: [{ target: 12, attempts: 2, successes: 1 }],
    reinforce: [],
    amplifyBelow10: 0,
    reinforceBelow12: 0,
    refine: 0
  })
  assert.deepEqual(
    days.map(({ date, enhance, highEnhancement }) => ({ date, enhance, highEnhancement })),
    [
      { date: '2026-07-18', enhance: 3, highEnhancement: true },
      { date: '2026-07-19', enhance: 2, highEnhancement: true }
    ]
  )
  assert.equal(toActivityDayDetail(day('2026-07-18'), { clears: [], items }).enhancements.length, 3)
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
    endsAt: null,
    timelineStartsAt: at('2026-03-26T06:00:00')
  })
  assert.deepEqual(findActivitySeason(seasons, 10), {
    id: 10,
    startsAt: at('2025-01-09T06:00:00'),
    endsAt: at('2026-03-26T06:00:00'),
    timelineStartsAt: at('2025-01-09T06:00:00')
  })
  assert.equal(findActivitySeason(seasons, 12), undefined)
  assert.equal(findActivitySeason([], undefined), undefined)
})

const dayDetail = (records: Partial<Parameters<typeof toActivityDayDetail>[1]>) =>
  toActivityDayDetail(day('2026-07-18'), { clears: [], items: [], ...records })

test('하루 상세는 그날 06:00부터 다음 날 06:00 전까지의 기록만 준다', () => {
  assert.deepEqual(day('2026-07-18'), {
    date: '2026-07-18',
    startsAt: at('2026-07-18T06:00:00'),
    endsAt: at('2026-07-19T06:00:00')
  })
  const detail = dayDetail({
    clears: [
      legion('2026-07-18T05:59:00', '아포칼립스'),
      legion('2026-07-18T06:00:00', '아포칼립스'),
      legion('2026-07-19T05:59:00', '아포칼립스'),
      legion('2026-07-19T06:00:00', '아포칼립스')
    ],
    items: [
      acquisition('2026-07-18T05:59:00', '에픽'),
      acquisition('2026-07-19T05:59:00', '에픽'),
      enhancement(402, '2026-07-19T06:00:00', 9, 10, true)
    ]
  })

  assert.deepEqual(detail.legions, [{ name: '아포칼립스', count: 2 }])
  assert.deepEqual(
    detail.items.map(({ at }) => at),
    ['2026-07-19T05:59:00+09:00']
  )
  assert.deepEqual(detail.enhancements, [])
})

test('YYYY-MM-DD가 아니거나 없는 날짜면 하루 구간을 만들지 않는다', () => {
  for (const date of ['2026-7-18', '20260718', '2026-07-18T06', '2026-02-30', '2026-13-01', '']) {
    assert.equal(toActivityDayRange(date), undefined, date)
  }
})

test('하루 상세도 레이드를 하드, 노말로 나누고 출시가 최근인 것부터, 표에 없는 이름은 뒤에 둔다', () => {
  const { raids, legions } = dayDetail({
    clears: [
      raid('2026-07-18T11:00:00', '합성 레이드'),
      raid('2026-07-18T11:30:00', '합성 레이드'),
      raid('2026-07-18T12:00:00', '이내 황혼전'),
      hardRaid('2026-07-18T13:00:00', '혼돈의 오즈마'),
      raid('2026-07-18T14:00:00', '혼돈의 오즈마'),
      legion('2026-07-18T15:00:00', '합성 레기온'),
      legion('2026-07-18T15:30:00', '합성 레기온'),
      legion('2026-07-18T16:00:00', '베누스'),
      legion('2026-07-18T17:00:00', '아포칼립스')
    ]
  })

  assert.deepEqual(raids, [
    { name: '이내 황혼전', count: 1, hard: 0, normal: 1 },
    { name: '혼돈의 오즈마', count: 2, hard: 1, normal: 1 },
    { name: '합성 레이드', count: 2, hard: 0, normal: 2 }
  ])
  assert.deepEqual(legions, [
    { name: '아포칼립스', count: 1 },
    { name: '베누스', count: 1 },
    { name: '합성 레기온', count: 2 }
  ])
})

test('하루 상세의 아이템과 강화는 캐릭터와 들어온 순서에 상관없이 시각 순이다', () => {
  const { items, enhancements } = dayDetail({
    items: [
      { ...acquisition('2026-07-18T21:00:00', '에픽'), characterId: 'b' },
      enhancement(401, '2026-07-19T01:30:00', 11, 12, false),
      acquisition('2026-07-18T09:58:00', '레전더리'),
      { ...enhancement(402, '2026-07-18T10:00:00', 9, 10, true), characterId: 'b' },
      acquisition('2026-07-19T02:00:00', '에픽')
    ]
  })

  assert.deepEqual(
    items.map(({ at }) => at),
    ['2026-07-18T09:58:00+09:00', '2026-07-18T21:00:00+09:00', '2026-07-19T02:00:00+09:00']
  )
  assert.deepEqual(
    enhancements.map(({ at }) => at),
    ['2026-07-18T10:00:00+09:00', '2026-07-19T01:30:00+09:00']
  )
})

test('하루 상세의 아이템은 획득 코드의 레전더리, 에픽, 태초, 신화만 등급 이름과 함께 준다', () => {
  const { items } = dayDetail({
    items: [
      { ...acquisition('2026-07-18T12:00:00', '레전더리'), itemName: '한계 : 선명한 광휘 결정' },
      acquisition('2026-07-18T12:01:00', '에픽'),
      acquisition('2026-07-18T12:02:00', '태초', 513),
      acquisition('2026-07-18T12:03:00', '신화', 557),
      acquisition('2026-07-18T12:04:00', '레어', 554),
      acquisition('2026-07-18T12:05:00', null, 501),
      enhancement(401, '2026-07-18T12:06:00', 5, 6, true)
    ]
  })

  assert.deepEqual(items, [
    { at: '2026-07-18T12:00:00+09:00', name: '한계 : 선명한 광휘 결정', rarity: '레전더리' },
    { at: '2026-07-18T12:01:00+09:00', name: null, rarity: '에픽' },
    { at: '2026-07-18T12:02:00+09:00', name: null, rarity: '태초' },
    { at: '2026-07-18T12:03:00+09:00', name: null, rarity: '신화' }
  ])
})

test('하루 상세의 강화는 종류, 도전한 단계 after와 성공 여부를 준다', () => {
  const { enhancements } = dayDetail({
    items: [
      enhancement(401, '2026-07-18T12:00:00', 14, 15, false),
      enhancement(401, '2026-07-18T12:01:00', 0, 13, true),
      enhancement(402, '2026-07-18T12:02:00', 0, 12, false),
      enhancement(403, '2026-07-18T12:03:00', null, 8, true),
      acquisition('2026-07-18T12:04:00', '에픽')
    ]
  })

  assert.deepEqual(enhancements, [
    { at: '2026-07-18T12:00:00+09:00', kind: 'reinforce', target: 15, success: false },
    { at: '2026-07-18T12:01:00+09:00', kind: 'reinforce', target: 13, success: true },
    { at: '2026-07-18T12:02:00+09:00', kind: 'amplify', target: 12, success: false },
    { at: '2026-07-18T12:03:00+09:00', kind: 'refine', target: 8, success: true }
  ])
})

test('시즌 하루 상세는 06시 경계와 시즌 구간을 지키고 하루 상세와 같으며 기록을 한 번씩 읽는다', async () => {
  const now = at('2026-07-21T12:00:00')
  const clears = [
    raid('2026-07-18T05:59:00', '디레지에 레이드'),
    legion('2026-07-18T06:00:00', '아포칼립스'),
    legion('2025-01-09T06:00:00', '베누스'),
    legion('2023-09-14T06:00:00', '이스핀즈'),
    raid('2026-03-26T05:59:00', '안톤'),
    raid('2026-07-21T12:00:00', '안톤')
  ]
  const items = [
    acquisition('2026-07-20T10:00:00', '레어'),
    enhancement(402, '2026-07-18T06:01:00', 9, 10, true),
    { ...acquisition('2026-07-18T05:58:00', '에픽'), itemName: '합성 아이템' }
  ]
  let eventQueries = 0
  let itemQueries = 0
  let backfillComplete = false
  const filter = <T extends { occurredAt: Date }>(
    rows: T[],
    args: { where: { occurredAt: { gte: Date; lt?: Date } } }
  ) =>
    rows.filter(
      ({ occurredAt }) =>
        occurredAt >= args.where.occurredAt.gte &&
        (args.where.occurredAt.lt === undefined || occurredAt < args.where.occurredAt.lt)
    )
  const client = {
    season: {
      findMany: async () => [
        { id: 9, name: '선계', startsAt: at('2023-09-14T06:00:00') },
        { id: 10, name: '중천', startsAt: at('2025-01-09T06:00:00') },
        { id: 11, name: '천해천', startsAt: season.startsAt },
        { id: 12, name: '다음 시즌', startsAt: season.endsAt }
      ]
    },
    $queryRaw: async () => [{ serverId: 'cain', characterId: 'synthetic' }],
    timelineSeasonBackfill: {
      findMany: async () =>
        backfillComplete
          ? [
              {
                serverId: 'cain',
                characterId: 'synthetic',
                backfilledUntil: at('2025-01-09T05:59:00'),
                completedAt: now
              }
            ]
          : []
    },
    timelineEvent: {
      findMany: async (args: Parameters<typeof filter>[1]) => {
        eventQueries++

        return filter(clears, args)
      }
    },
    timelineItem: {
      findMany: async (args: Parameters<typeof filter>[1]) => {
        itemQueries++

        return filter(items, args)
      }
    }
  } as unknown as DatabaseClient

  const result = await readAdventureSeasonDays(client, '합성', 11, now)
  assert.ok(result)
  assert.equal(result.season, 11)
  assert.deepEqual(
    result.days.map(({ date }) => date),
    ['2026-07-17', '2026-07-18']
  )
  assert.deepEqual(result.days[0], {
    date: '2026-07-17',
    raids: [{ name: '디레지에 레이드', count: 1, hard: 0, normal: 1 }],
    legions: [],
    items: [{ at: '2026-07-18T05:58:00+09:00', name: '합성 아이템', rarity: '에픽' }],
    enhancements: []
  })
  assert.deepEqual(result.days[1], {
    date: '2026-07-18',
    raids: [],
    legions: [{ name: '아포칼립스', count: 1 }],
    items: [],
    enhancements: [{ at: '2026-07-18T06:01:00+09:00', kind: 'amplify', target: 10, success: true }]
  })
  assert.deepEqual([eventQueries, itemQueries], [1, 1])
  assert.deepEqual(await readAdventureSeasonDays(client, '합성', 9, now), { season: 9, days: [] })
  backfillComplete = true
  assert.deepEqual(
    (await readAdventureSeasonDays(client, '합성', 9, now))?.days.map(({ date }) => date),
    ['2023-09-14']
  )
  assert.deepEqual(
    (await readAdventureSeasonDays(client, '합성', 10, now))?.days.map(({ date }) => date),
    ['2025-01-09', '2026-03-25']
  )
  assert.equal(await readAdventureSeasonDays(client, '합성', 12, now), undefined)
  assert.equal(await readAdventureSeasonDays(client, '합성', 99, now), undefined)
})

async function listen(
  reader: Partial<
    Pick<
      AdventureGuildReader,
      'readAdventureActivity' | 'readAdventureSeasonDays' | 'readAdventureSeasonBackfill'
    >
  >,
  syncTimeline: (character: TimelineCharacter) => Promise<void>
): Promise<{ app: INestApplication; origin: string }> {
  const unused = async (): Promise<never> => assert.fail('부르면 안 된다')
  const app = await createApiHttpApp({
    search: { searchCharacters: unused },
    details: { fetchDetails: unused, catalog: createCatalogService(unused) },
    todayGrade: { fetchShopGrade: unused },
    adventureGuild: {
      readAdventureCharacters: unused,
      readGuild: unused,
      readAdventureWeeklyClears: unused,
      readAdventureActivity: unused,
      readAdventureSeasonDays: unused,
      readAdventureSeasonBackfill: unused,
      ...reader
    },
    timeline: {
      sync: syncTimeline,
      read: unused,
      readPage: unused,
      backfillEnhancements: unused,
      backfillSeason: unused,
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
    {
      readAdventureActivity: async (adventureName, seasonId) => {
        reads.push([adventureName, seasonId])

        return activityRead
      }
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
      season: {
        id: 11,
        startsAt: '2026-03-25T21:00:00.000Z',
        endsAt: null,
        timelineStartsAt: '2026-03-25T21:00:00.000Z'
      },
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
    {
      readAdventureActivity: async (_adventureName, seasonId) => {
        reads.push(seasonId)

        return undefined
      }
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

test('시즌 하루 상세는 시즌을 전달하고 동기화하지 않으며 잘못된 시즌에 query 오류를 준다', async () => {
  const reads: [string, number][] = []
  const requested: TimelineCharacter[] = []
  const result = {
    season: 11,
    days: [dayDetail({ clears: [raid('2026-07-18T12:00:00', '디레지에 레이드')] })]
  }
  const { app, origin } = await listen(
    {
      readAdventureSeasonDays: async (name, seasonId) => {
        reads.push([name, seasonId])
        if (seasonId === 11) {
          return result
        }

        return undefined
      }
    },
    async (character) => {
      requested.push(character)
    }
  )
  try {
    const name = encodeURIComponent('합성 모험단')
    const response = await fetch(new URL(`/adventures/${name}/activity/seasons/11/days`, origin))
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), result)
    for (const value of ['0', '1.5', 'abc', '10000', '12', '99']) {
      const invalid = await fetch(
        new URL(`/adventures/${name}/activity/seasons/${value}/days`, origin)
      )
      assert.equal(invalid.status, 400, value)
      assert.equal((await invalid.json()).error.code, 'INVALID_CHARACTER_QUERY', value)
    }
    assert.deepEqual(reads, [
      ['합성 모험단', 11],
      ['합성 모험단', 12],
      ['합성 모험단', 99]
    ])
    assert.deepEqual(requested, [])
  } finally {
    await app.close()
  }
})
