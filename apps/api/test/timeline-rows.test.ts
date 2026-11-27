import assert from 'node:assert/strict'
import test from 'node:test'
import type { TimelineEventRow, TimelineItemRow } from '@dfragon/database'
import {
  parseTimelineClearRow,
  parseTimelineEnhancementRow
} from '../src/infrastructure/database/timeline-rows.js'
import { startOfResetWeek } from '@dfragon/server-core/domain/seoul-time.js'

const occurredAt = new Date('2026-11-05T12:00:00+09:00')

function event(row: Partial<TimelineEventRow> & Pick<TimelineEventRow, 'code'>): TimelineEventRow {
  return {
    occurredAt,
    name: '레이드',
    raidName: null,
    data: {},
    ...row
  }
}

function item(row: Partial<TimelineItemRow> & Pick<TimelineItemRow, 'code'>): TimelineItemRow {
  return {
    id: 1n,
    occurredAt,
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

test('레이드는 raid_name, 레기온은 regionName을 이름으로 쓰고 하드가 없는 레이드는 하드가 아니다', () => {
  const clears = [
    event({
      code: 201,
      raidName: '만들어진 신 나벨',
      data: { modeName: '나벨 : 무지의 악', hard: true }
    }),
    event({ code: 210, raidName: '이내 황혼전' }),
    event({ code: 209, data: { regionName: '베누스' } })
  ].flatMap(parseTimelineClearRow)

  assert.deepEqual(clears, [
    {
      kind: 'raid',
      name: '만들어진 신 나벨',
      modeName: '나벨 : 무지의 악',
      hard: true,
      occurredAt
    },
    { kind: 'raid', name: '이내 황혼전', modeName: null, hard: false, occurredAt },
    { kind: 'legion', name: '베누스', modeName: null, hard: false, occurredAt }
  ])
})

test('강화, 증폭, 재련의 종류를 나누고 재련에 없는 before, safe는 null로 둔다', () => {
  const enhancements = [
    item({ code: 402, data: { safe: false, after: 13, before: 12, result: false } }),
    item({ code: 403, itemRarity: '유니크', data: { after: 8, result: true } }),
    item({ code: 401, data: { safe: true, after: 10, before: 9, result: true } })
  ].flatMap(parseTimelineEnhancementRow)

  assert.deepEqual(
    enhancements.map(({ kind, itemRarity, before, after, result, safe }) => ({
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
  const clears = [
    event({ code: 201, raidName: '디레지에 레이드', data: { modeName: 3, hard: 'true' } }),
    event({ code: 209, data: { regionName: null } }),
    event({ code: 210, raidName: null, data: { modeName: '합성 난이도' } })
  ].flatMap(parseTimelineClearRow)
  const enhancements = [
    item({ code: 401, data: { before: '9', after: 10, result: true, safe: 'yes' } }),
    item({ code: 402, data: { before: 12, result: false } }),
    item({ code: 403, data: { after: '8', result: true } }),
    item({ code: 402, data: { after: 13, result: 'false' } })
  ].flatMap(parseTimelineEnhancementRow)

  assert.deepEqual(clears, [
    { kind: 'raid', name: '디레지에 레이드', modeName: null, hard: false, occurredAt }
  ])
  assert.deepEqual(
    enhancements.map(({ kind, before, after, result, safe }) => ({
      kind,
      before,
      after,
      result,
      safe
    })),
    [{ kind: 'reinforce', before: null, after: 10, result: true, safe: null }]
  )
})
