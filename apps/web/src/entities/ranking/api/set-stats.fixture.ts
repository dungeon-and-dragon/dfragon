import type { SetStats } from '#core/ranking'

// 비율은 #1781 시안의 합성 값이다. 세트 id와 이름, 선택지 이름은 게임 데이터 그대로다.
const SAMPLE_SIZE = 412_380

function countOf(percent: number): number {
  return Math.round((SAMPLE_SIZE * percent) / 100)
}

const EQUIPMENT_SETS: readonly (readonly [string | null, string | null, number])[] = [
  ['7f788a703a87d783079b41d0fe6448c9', '영원히 이어지는 황금향 세트', 18.4],
  ['11f7d203a05ea6f13300c0facb39f11e', '칠흑의 정화 세트', 16.9],
  ['4ee7bd5912cda6e2a24c1f36d5202b46', '소울 페어리 세트', 14.2],
  ['93e7825053bdec4e0f4c12837cf4f57e', '에테리얼 오브 아츠 세트', 12.7],
  ['3af7c961e7d8cd8b5b42c5f82af2a0ad', '그림자에 숨은 죽음 세트', 11.3],
  ['854dc8c01b1bc231e132dae5df3c52bc', '고대 전장의 발키리 세트', 9.8],
  ['b92ca7784123b5fea9cea40144925194', '용투장의 난 세트', 7.7],
  ['story-equipment-set', '나아가려는 자의 마음 세트', 0.4],
  [null, null, 8.6]
]

const OATH_SETS: readonly (readonly [
  number | null,
  string | null,
  number,
  readonly (readonly [string, number])[]
])[] = [
  [
    16204,
    '야망의 용투 서약',
    15.2,
    [
      ['용투 : 세계를 태우는 불꽃', 71.4],
      ['용투 : 용제 강림', 28.6]
    ]
  ],
  [
    16205,
    '완전무결한 정화 서약',
    13.1,
    [
      ['정화 : 찬란한 정화', 52.3],
      ['정화 : 심연의 타락', 39],
      ['정화 : 혼돈', 8.7]
    ]
  ],
  [
    16203,
    '이상이 담긴 황금 서약',
    11.8,
    [
      ['황금 : 황금의 세계', 44.1],
      ['황금 : 끝나지 않는 꿈', 40.2],
      ['황금 : 숭배하라, 세상의 왕을', 15.7]
    ]
  ],
  [
    16202,
    '태고의 페어리 서약',
    10.4,
    [
      ['페어리 : 로열가드', 61.5],
      ['페어리 : 노블 엠프레스', 38.5]
    ]
  ],
  [
    16201,
    '어둠에 잠긴 그림자 서약',
    9.6,
    [
      ['그림자 : 죽음의 형상', 50],
      ['그림자 : 배후 습격', 30],
      ['그림자 : 그림자 동화', 20]
    ]
  ],
  [16209, '영전의 발키리 서약', 8.2, [['발키리 : 심판의 창', 100]]],
  [16210, '조화의 여우 서약', 7.1, [['여우 : 초월', 100]]],
  [16206, '운명의 행운 서약', 5.9, [['행운 : 일궈낸 운명', 100]]],
  [16207, '극복의 한계 서약', 13.9, [['한계 : 무한동력', 100]]],
  [null, null, 4.8, []]
]

const COMBOS: readonly (readonly [string | null, number | null, number])[] = [
  ['7f788a703a87d783079b41d0fe6448c9', 16203, 9.7],
  ['11f7d203a05ea6f13300c0facb39f11e', 16205, 8.9],
  ['4ee7bd5912cda6e2a24c1f36d5202b46', 16202, 7.6],
  ['93e7825053bdec4e0f4c12837cf4f57e', 16210, 6.2],
  ['b92ca7784123b5fea9cea40144925194', 16204, 5.8],
  ['3af7c961e7d8cd8b5b42c5f82af2a0ad', 16201, 5.4],
  ['854dc8c01b1bc231e132dae5df3c52bc', 16209, 4.9],
  ['7f788a703a87d783079b41d0fe6448c9', 16204, 3.1],
  ['7f788a703a87d783079b41d0fe6448c9', null, 1.2],
  [null, null, 2.4]
]

// 반올림한 수의 합이 전체와 맞도록 마지막 항목이 나머지를 갖는다.
function withRemainder<Item extends { count: number }>(items: Item[], total: number): Item[] {
  const last = items.at(-1)
  if (last === undefined) {
    return items
  }

  const restCount = items.slice(0, -1).reduce((sum, item) => sum + item.count, 0)

  return [...items.slice(0, -1), { ...last, count: total - restCount }]
}

function optionsOf(setCount: number, options: readonly (readonly [string, number])[]) {
  if (options.length === 0) {
    return [{ name: null, count: setCount }]
  }

  const counted = options.map(([name, percent]) => {
    const count = Math.round((setCount * percent) / 100)

    return { name, count }
  })

  return withRemainder(counted, setCount)
}

// 시안에 보인 조합 밖의 나머지는 시안에 없던 세트 쌍에 고르게 나눠 상위 조합에 들지 않게 한다.
function combosOf() {
  const listed = COMBOS.map(([equipmentSetId, oathSetId, percent]) => {
    const count = countOf(percent)

    return { equipmentSetId, oathSetId, count }
  })
  const listedKeys = new Set(
    listed.map(({ equipmentSetId, oathSetId }) => `${equipmentSetId}/${oathSetId}`)
  )
  const pairs = EQUIPMENT_SETS.flatMap(([equipmentSetId]) =>
    OATH_SETS.flatMap(([oathSetId]) => {
      if (
        equipmentSetId === null ||
        oathSetId === null ||
        listedKeys.has(`${equipmentSetId}/${oathSetId}`)
      ) {
        return []
      }

      return [{ equipmentSetId, oathSetId }]
    })
  )
  const rest = SAMPLE_SIZE - listed.reduce((sum, { count }) => sum + count, 0)
  const each = Math.floor(rest / pairs.length)
  const filled = pairs.map((pair) => ({ ...pair, count: each }))

  return [...listed, ...withRemainder(filled, rest)]
}

export function storySetStats(computedAt: string): SetStats {
  const equipmentCounts = EQUIPMENT_SETS.map(([setId, name, percent]) => {
    const count = countOf(percent)

    return { setId, name, count }
  })
  const equipmentSets = withRemainder(equipmentCounts, SAMPLE_SIZE)
  const oathCounts = OATH_SETS.map(([setId, name, percent, options]) => {
    const count = countOf(percent)
    const counted = optionsOf(count, options)

    return { setId, name, count, options: counted }
  })
  const oathSets = withRemainder(oathCounts, SAMPLE_SIZE).map((oathSet) => {
    if (oathSet.setId !== null) {
      return oathSet
    }

    return { ...oathSet, options: [{ name: null, count: oathSet.count }] }
  })
  const combos = combosOf()

  return { computedAt, sampleSize: SAMPLE_SIZE, equipmentSets, oathSets, combos }
}
