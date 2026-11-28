import { expect, it } from 'vitest'
import { type EquipmentCharacter, toEquipmentBoard } from './adventure-equipment'

const SET = 'set-a'
const OTHER_SET = 'set-b'

type Equipment = EquipmentCharacter['equipment'][number]
type Oath = EquipmentCharacter['oaths'][number]

function character(
  name: string,
  fame: number | null,
  equipment: Equipment[] = [],
  oaths: Oath[] = []
): EquipmentCharacter {
  return {
    serverId: 'cain',
    characterId: `id-${name}`,
    characterName: name,
    adventureName: '합성 모험단',
    level: 115,
    jobId: null,
    jobGrowId: null,
    jobName: null,
    jobGrowName: null,
    fame,
    guildId: null,
    guildName: null,
    role: null,
    score: null,
    equipment,
    oaths
  }
}

function equipment(slot: string, rarity: string, count = 1, setItemId = SET): Equipment {
  return {
    setItemId,
    slot,
    rarity,
    itemId: `${slot}-${rarity}`,
    itemName: `${rarity} ${slot}`,
    count
  }
}

function oath(kind: Oath['kind'], rarity: string, count = 1, setItemId = SET): Oath {
  return {
    setItemId,
    kind,
    rarity,
    itemId: `${kind}-${rarity}`,
    itemName: `${rarity} ${kind}`,
    count
  }
}

function slotCell(row: ReturnType<typeof toEquipmentBoard>[number], slot: string) {
  return row.slots.find((entry) => entry.slot === slot)?.cell
}

it('같은 부위에 에픽과 태초가 있으면 태초를 보이고, 남은 개수는 태초만 세며 레전더리를 뺀 등급별 개수를 따로 둔다', () => {
  const source = character('가', 1, [
    equipment('상의', '에픽', 2),
    equipment('상의', '태초', 3),
    equipment('상의', '레전더리')
  ])
  const [row] = toEquipmentBoard([source], SET)

  expect(slotCell(row!, '상의')).toEqual({
    itemId: '상의-태초',
    itemName: '태초 상의',
    rarity: '태초',
    extraCount: 2,
    rarityCounts: [3, 2]
  })
})

it('에픽과 레전더리가 하나씩이면 에픽을 보이고 남은 개수는 없다', () => {
  const source = character('가', 1, [equipment('반지', '레전더리'), equipment('반지', '에픽')])
  const [row] = toEquipmentBoard([source], SET)

  expect(slotCell(row!, '반지')).toMatchObject({
    rarity: '에픽',
    extraCount: 0,
    rarityCounts: [0, 1]
  })
})

it('레전더리만 가진 부위와 서약은 비운다', () => {
  const source = character(
    '가',
    1,
    [equipment('반지', '레전더리')],
    [oath('oath', '레전더리'), oath('crystal', '레전더리', 5)]
  )
  const [row] = toEquipmentBoard([source], SET)

  expect(slotCell(row!, '반지')).toBeNull()
  expect(row!.oath).toBeNull()
  expect(row!.crystals).toEqual([null, null])
})

it('고른 세트가 아닌 보유는 칸에 넣지 않고, 가진 것이 없는 부위는 비운다', () => {
  const source = character('가', 1, [
    equipment('상의', '태초', 1, OTHER_SET),
    equipment('하의', '에픽')
  ])
  const [row] = toEquipmentBoard([source], SET)

  expect(slotCell(row!, '상의')).toBeNull()
  expect(slotCell(row!, '하의')).toMatchObject({ rarity: '에픽', extraCount: 0 })
})

it('열은 상의부터 귀걸이까지 11부위 순서다', () => {
  const [row] = toEquipmentBoard([character('가', 1)], SET)

  expect(row!.slots.map(({ slot }) => slot)).toEqual([
    '상의',
    '머리어깨',
    '하의',
    '신발',
    '벨트',
    '목걸이',
    '팔찌',
    '반지',
    '보조장비',
    '마법석',
    '귀걸이'
  ])
})

it('행은 명성이 높은 순서이고 명성이 없는 캐릭터와 가진 것이 없는 캐릭터도 남긴다', () => {
  const characters = [
    character('낮음', 100, [equipment('상의', '에픽')]),
    character('없음', null),
    character('높음', 300)
  ]
  const rows = toEquipmentBoard(characters, SET)

  expect(rows.map(({ character: { characterName } }) => characterName)).toEqual([
    '높음',
    '낮음',
    '없음'
  ])
  expect(rows[0]!.slots.every(({ cell }) => cell === null)).toBe(true)
  expect(rows[0]!.oath).toBeNull()
  expect(rows[0]!.crystals).toEqual([null, null])
})

it('서약은 가장 높은 등급의 본체를 보이고 결정은 태초, 에픽 순으로 등급별 개수를 더한다', () => {
  const source = character(
    '가',
    1,
    [],
    [
      oath('oath', '에픽'),
      oath('oath', '태초'),
      oath('crystal', '에픽', 3),
      oath('crystal', '에픽', 2),
      oath('crystal', '레전더리', 2),
      oath('crystal', '태초', 4, OTHER_SET)
    ]
  )
  const [row] = toEquipmentBoard([source], SET)

  expect(row!.oath).toMatchObject({ itemName: '태초 oath', rarity: '태초' })
  expect(row!.crystals).toEqual([
    null,
    { itemId: 'crystal-에픽', itemName: '에픽 crystal', rarity: '에픽', count: 5 }
  ])
})

it('세트를 고르지 않으면 장비 칸을 비운다', () => {
  const source = character('가', 1, [equipment('상의', '에픽')])
  const [row] = toEquipmentBoard([source], undefined)

  expect(slotCell(row!, '상의')).toBeNull()
})
