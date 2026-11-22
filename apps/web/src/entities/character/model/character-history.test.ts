import { describe, expect, it } from 'vitest'
import {
  type CharacterHistory,
  characterHistorySchema,
  toHistoryPoints,
  toHistorySnapshotSummary
} from './character-history'

const FIRST = '2026-11-05T13:00:00.000Z'
const SECOND = '2026-11-08T06:31:00.000Z'
const THIRD = '2026-11-13T11:40:00.000Z'

function history(overrides: Partial<CharacterHistory> = {}): CharacterHistory {
  return {
    basics: [
      { observedAt: FIRST, fame: 134861 },
      { observedAt: THIRD, fame: 135980 }
    ],
    scores: [
      { observedAt: FIRST, calculator: 'equipment', value: 1268402, approximate: null },
      { observedAt: FIRST, calculator: 'buff', value: 4000000, approximate: null },
      { observedAt: SECOND, calculator: 'equipment', value: 1281950, approximate: null }
    ],
    sectionChanges: {
      equipment: [FIRST, SECOND],
      avatar: [FIRST],
      creature: [FIRST, THIRD],
      buff_avatar: [FIRST, SECOND],
      status: [FIRST, SECOND, THIRD]
    },
    nameChanges: [],
    changes: [
      { observedAt: FIRST, first: true, items: [] },
      {
        observedAt: SECOND,
        first: false,
        items: [
          {
            kind: 'equipment',
            slotId: 'HEAD',
            slotName: '머리어깨',
            itemName: '머리어깨 2',
            itemRarity: '에픽',
            replaced: { itemName: '머리어깨 1', itemRarity: '레전더리' },
            fields: []
          },
          {
            kind: 'set',
            setItemId: 'set-1',
            setItemName: '세트 1',
            fields: [{ field: 'point', name: null, before: 2400, after: 2455 }]
          }
        ]
      },
      {
        observedAt: THIRD,
        first: false,
        items: [
          {
            kind: 'artifact',
            slotColor: 'RED',
            itemName: '아티팩트 2',
            itemRarity: '유니크',
            replaced: null
          },
          {
            kind: 'artifact',
            slotColor: 'BLUE',
            itemName: '아티팩트 3',
            itemRarity: '유니크',
            replaced: null
          }
        ]
      }
    ],
    ...overrides
  }
}

describe('toHistoryPoints', () => {
  it('변경점 시점을 최신 순으로 두고 그 시각까지 받은 명성과 고른 계산기의 점수를 붙인다', () => {
    const points = toHistoryPoints(history(), 'equipment')

    expect(points.map(({ observedAt, fame, score }) => ({ observedAt, fame, score }))).toEqual([
      { observedAt: THIRD, fame: 135980, score: 1281950 },
      { observedAt: SECOND, fame: 134861, score: 1281950 },
      { observedAt: FIRST, fame: 134861, score: 1268402 }
    ])
    expect(toHistoryPoints(history(), 'buff').map(({ score }) => score)).toEqual([
      4000000, 4000000, 4000000
    ])
  })

  it('시점의 점수가 근사값으로 저장한 이력이면 그 시점을 근사값으로 표시한다', () => {
    const scores: CharacterHistory['scores'] = [
      { observedAt: FIRST, calculator: 'equipment', value: 1268402, approximate: null },
      {
        observedAt: SECOND,
        calculator: 'equipment',
        value: 1250000,
        approximate: { source: 'legacy_fusion_policy_a' }
      }
    ]
    const points = toHistoryPoints(history({ scores }), 'equipment')

    expect(points.map(({ score, approximate }) => [score, approximate])).toEqual([
      [1250000, true],
      [1250000, true],
      [1268402, false]
    ])
  })

  it('근사 여부를 보내지 않는 API의 점수 이력은 정확한 점수로 읽는다', () => {
    const { scores } = characterHistorySchema.parse({
      ...history(),
      scores: [{ observedAt: FIRST, calculator: 'equipment', value: 1268402 }]
    })

    expect(scores).toEqual([
      { observedAt: FIRST, calculator: 'equipment', value: 1268402, approximate: null }
    ])
  })

  it('바뀐 부위는 장비 부위 이름, 세트, 크리쳐로 한 번씩 적는다', () => {
    const points = toHistoryPoints(history(), 'equipment')

    expect(points.map(({ parts }) => parts)).toEqual([['크리쳐'], ['머리어깨', '세트'], []])
  })

  it('그대로에는 그 시각에 본문이 바뀌지 않은 섹션만 두고, 버프 강화는 세 섹션 가운데 하나라도 바뀌면 뺀다', () => {
    const [third, second, first] = toHistoryPoints(history(), 'equipment')

    expect(third?.unchanged).toEqual(['장비', '아바타', '서약', '스킬', '버프 강화', '안개 융화'])
    expect(second?.unchanged).toEqual(['아바타', '크리쳐', '서약', '스킬', '안개 융화'])
    expect(first?.unchanged).toEqual([])
  })

  it('명성이나 점수 이력이 그 시각보다 늦게만 있으면 값을 비운다', () => {
    const points = toHistoryPoints(
      history({ basics: [{ observedAt: THIRD, fame: 135980 }], scores: [] }),
      'equipment'
    )

    expect(points.map(({ fame, score }) => [fame, score])).toEqual([
      [135980, null],
      [null, null],
      [null, null]
    ])
  })
})

describe('toHistorySnapshotSummary', () => {
  it('현재 포인트가 있는 첫 세트의 포인트와 안개 융화 레벨을 읽는다', () => {
    const set = (current: number | null) => ({
      setItemId: null,
      setItemName: null,
      setItemRarityName: null,
      active: { setPoint: { current, min: null, max: null }, status: [] }
    })

    expect(
      toHistorySnapshotSummary({
        equipment: { equipment: [], setItemInfo: [set(null), set(2555)] },
        mistAssimilation: { level: 100, expRate: null, status: [] }
      })
    ).toEqual({ setPoint: 2555, mistLevel: 100 })
    expect(
      toHistorySnapshotSummary({
        equipment: { equipment: [], setItemInfo: [] },
        mistAssimilation: null
      })
    ).toEqual({ setPoint: null, mistLevel: null })
  })
})
