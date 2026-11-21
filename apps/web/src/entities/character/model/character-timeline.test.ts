import { expect, it } from 'vitest'
import {
  type CharacterTimeline,
  characterTimelineSchema,
  timelineAcquisitionPageSchema
} from './character-timeline'

function readTimeline(body: unknown): CharacterTimeline {
  return characterTimelineSchema.parse(body)
}

const filled: CharacterTimeline = {
  seasonClears: [{ kind: 'raid', name: '디레지에 레이드', hard: true, count: 3 }],
  enhancements: [
    {
      kind: 'refine',
      itemId: 'item-1',
      itemName: '합성 무기',
      itemRarity: '태초',
      before: null,
      after: 8,
      result: true,
      safe: null,
      occurredAt: '2026-11-04T10:00:00.000Z'
    }
  ],
  enhancementsCursor: 'enhancement-cursor',
  acquisitions: [
    {
      code: 505,
      name: '아이템 획득(던전 드랍)',
      itemId: 'item-2',
      itemName: '합성 상의',
      itemRarity: '에픽',
      occurredAt: '2026-11-03T10:00:00.000Z'
    }
  ],
  acquisitionsCursor: null
}

const empty: CharacterTimeline = {
  seasonClears: [],
  enhancements: [],
  enhancementsCursor: null,
  acquisitions: [],
  acquisitionsCursor: null
}

it('값이 있는 응답과 빈 응답을 그대로 읽는다', () => {
  expect(readTimeline(filled)).toEqual(filled)
  expect(readTimeline(empty)).toEqual(empty)
})

it('hard를 주지 않는 API의 클리어는 하드가 아닌 것으로 읽는다', () => {
  const { hard: _seasonHard, ...season } = filled.seasonClears[0]

  expect(readTimeline({ ...empty, seasonClears: [season] })).toEqual({
    ...empty,
    seasonClears: [{ ...season, hard: false }]
  })
})

it('cursor를 보내지 않는 API의 응답은 강화, 획득을 더 받을 수 없는 것으로 읽는다', () => {
  const { enhancementsCursor: _enhancements, acquisitionsCursor: _acquisitions, ...before } = filled

  expect(readTimeline(before)).toEqual({
    ...filled,
    enhancementsCursor: null,
    acquisitionsCursor: null
  })
})

it('이어 받기 응답의 행이 타임라인 형식과 다르면 읽지 않는다', () => {
  const page = { items: [{ ...filled.acquisitions[0], itemRarity: '레전더리' }], nextCursor: null }

  expect(timelineAcquisitionPageSchema.safeParse(page).success).toBe(false)
})

it.each([
  ['목록이 빠진 응답', { ...empty, acquisitions: undefined }],
  [
    '모르는 클리어 종류',
    { ...empty, seasonClears: [{ kind: 'dungeon', name: '이름', hard: false, count: 1 }] }
  ],
  [
    '에픽, 태초가 아닌 획득',
    { ...empty, acquisitions: [{ ...filled.acquisitions[0], itemRarity: '레전더리' }] }
  ],
  [
    '시각이 아닌 occurredAt',
    { ...empty, enhancements: [{ ...filled.enhancements[0], occurredAt: '어제' }] }
  ]
])('%s는 읽지 않는다', (_name, body) => {
  expect(characterTimelineSchema.safeParse(body).success).toBe(false)
})
