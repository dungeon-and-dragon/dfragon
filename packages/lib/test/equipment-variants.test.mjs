import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  EQUIPMENT_VARIANT_SLOTS,
  equipmentVariantsOf,
  findEquipmentVariant,
  findOathCrystal,
  resolveEquipmentItems
} from '@dfragon/lib/equipment-variants'

// build가 생성 파일을 dist에 함께 실어야 package export로 읽힌다.
const tableUrl = new URL('../dist/equipment-variants.json', import.meta.url)
const observedUrl = new URL('../data/equipment-variant-ids.json', import.meta.url)
const table = JSON.parse(readFileSync(tableUrl, 'utf8'))
const observed = JSON.parse(readFileSync(observedUrl, 'utf8'))

const SHADOW_SET = '3af7c961e7d8cd8b5b42c5f82af2a0ad'
const DIMENSION_SET = 'b9403caf99c157682d1d468d899e9aaa'
const SOUL_FAIRY_SET = '4ee7bd5912cda6e2a24c1f36d5202b46'
const ARMOR_SLOTS = ['JACKET', 'SHOULDER', 'PANTS', 'SHOES', 'WAIST']
const SPECIAL_SLOTS = ['SUPPORT', 'MAGIC_STON', 'EARRING']
const SHARED_NAMES = [
  '긍휼 속 자비의 상의',
  '숭고한 심판의 어깨',
  '명예로운 공경의 하의',
  '고요한 안식의 신발',
  '완전한 침묵의 벨트',
  '성스러운 믿음의 목걸이',
  '드러난 진실의 팔찌',
  '거룩한 희생의 반지',
  '초연한 청렴의 보조장비',
  '무결한 순수의 마법석',
  '강인한 절제의 귀걸이'
]
const fullSets = table.sets.filter(({ setItemId }) => setItemId !== DIMENSION_SET)

function gradesOf(setItemId, slotId) {
  return equipmentVariantsOf(setItemId, slotId).map(({ rarity, kind }) => `${rarity} ${kind}`)
}

function variantOf(setItemId, slotId, rarity, kind) {
  const found = equipmentVariantsOf(setItemId, slotId).find(
    (variant) => variant.rarity === rarity && variant.kind === kind
  )

  assert.ok(found, `${setItemId} ${slotId} ${rarity} ${kind}`)

  return found
}

function selectionOf(setItemId, kinds) {
  return Object.fromEntries(
    Object.entries(kinds).map(([slotId, [rarity, kind]]) => [
      slotId,
      variantOf(setItemId, slotId, rarity, kind)
    ])
  )
}

function itemNamesOf(items) {
  return Object.fromEntries(Object.entries(items).map(([slotId, item]) => [slotId, item.itemName]))
}

test('생성 파일은 13개 세트를 두고, 그림자에 숨은 죽음, 소울 페어리, 차원 속의 이야기 세트는 관측한 setItemId를 가진다', () => {
  const setItemIdOf = (name) =>
    table.sets.find(({ setItemName }) => setItemName === name)?.setItemId

  assert.equal(table.version, 1)
  assert.equal(table.sets.length, 13)
  assert.equal(setItemIdOf('그림자에 숨은 죽음 세트'), SHADOW_SET)
  assert.equal(setItemIdOf('소울 페어리 세트'), SOUL_FAIRY_SET)
  assert.equal(setItemIdOf('차원 속의 이야기 세트'), DIMENSION_SET)
})

test('방어구 5부위는 세트마다 유니크, 레전더리, 에픽, 잠식, 축성을 고른다', () => {
  for (const { setItemId } of fullSets) {
    for (const slotId of ARMOR_SLOTS) {
      assert.deepEqual(
        gradesOf(setItemId, slotId),
        ['유니크 일반', '레전더리 일반', '에픽 일반', '에픽 잠식', '에픽 축성'],
        `${setItemId} ${slotId}`
      )
      assert.match(variantOf(setItemId, slotId, '에픽', '축성').item.itemName, /^축성 : /)
    }
  }
})

test('목걸이, 팔찌는 태초와 흑아 태초까지, 반지는 거기에 유일 장비를 더해 고른다', () => {
  const grades = ['유니크 일반', '레전더리 일반', '에픽 일반', '태초 일반', '태초 흑아']

  for (const { setItemId } of fullSets) {
    assert.deepEqual(gradesOf(setItemId, 'AMULET'), grades)
    assert.deepEqual(gradesOf(setItemId, 'WRIST'), grades)
    assert.deepEqual(gradesOf(setItemId, 'RING'), [...grades, '태초 유일'])
  }
  assert.equal(variantOf(SHADOW_SET, 'RING', '태초', '유일').item.itemName, '광휘를 머금은 눈동자')
})

test('보조장비, 마법석, 귀걸이는 유니크, 레전더리, 에픽과 유일 장비를 고른다', () => {
  const exaltedNames = {
    SUPPORT: '만병을 잉태한 역병의 심장',
    MAGIC_STON: '우아한 기품의 향수',
    EARRING: '영롱한 날씨의 큐브'
  }

  for (const { setItemId } of fullSets) {
    for (const slotId of SPECIAL_SLOTS) {
      assert.deepEqual(gradesOf(setItemId, slotId), [
        '유니크 일반',
        '레전더리 일반',
        '에픽 일반',
        '태초 유일'
      ])
      assert.equal(variantOf(setItemId, slotId, '태초', '유일').item.itemName, exaltedNames[slotId])
    }
  }
})

test('흑아 에픽, 공용 이름, 레어 아이템은 어느 선택지에도 없다', () => {
  for (const { setItemId } of table.sets) {
    for (const slotId of EQUIPMENT_VARIANT_SLOTS) {
      for (const { rarity, kind, item } of equipmentVariantsOf(setItemId, slotId)) {
        const name = `${setItemId} ${slotId} ${item.itemName}`

        assert.notEqual(rarity, '레어', name)
        assert.ok(!(rarity === '에픽' && kind === '흑아'), name)
        assert.ok(!SHARED_NAMES.includes(item.itemName), name)
      }
    }
  }
})

test('차원 속의 이야기 세트는 유니크, 레전더리와 세트 밖 유일 장비만 고른다', () => {
  for (const slotId of EQUIPMENT_VARIANT_SLOTS) {
    const exalted = ['RING', ...SPECIAL_SLOTS].includes(slotId) ? ['태초 유일'] : []

    assert.deepEqual(gradesOf(DIMENSION_SET, slotId), ['유니크 일반', '레전더리 일반', ...exalted])
  }
})

test('선택지 id는 세트 안에서 겹치지 않는다', () => {
  for (const { setItemId } of table.sets) {
    const ids = EQUIPMENT_VARIANT_SLOTS.flatMap((slotId) =>
      equipmentVariantsOf(setItemId, slotId).map(({ id }) => id)
    )

    assert.equal(new Set(ids).size, ids.length, setItemId)
  }
})

test('없는 세트의 선택지는 빈 목록이다', () => {
  assert.deepEqual(equipmentVariantsOf('missing-set', 'JACKET'), [])
})

test('조율 단계별 세트 포인트는 등급과 종류마다 정해진 값이다', () => {
  assert.deepEqual(
    variantOf(SHADOW_SET, 'JACKET', '에픽', '일반').tuneSetPoints,
    [215, 225, 235, 245]
  )
  assert.deepEqual(
    variantOf(SHADOW_SET, 'SHOES', '에픽', '잠식').tuneSetPoints,
    [235, 245, 255, 265]
  )
  assert.deepEqual(
    variantOf(SHADOW_SET, 'WAIST', '에픽', '축성').tuneSetPoints,
    [235, 245, 255, 265]
  )
  assert.deepEqual(variantOf(SHADOW_SET, 'AMULET', '태초', '일반').tuneSetPoints, [265])
  assert.deepEqual(variantOf(SHADOW_SET, 'WRIST', '태초', '흑아').tuneSetPoints, [265])
  assert.deepEqual(variantOf(SHADOW_SET, 'SUPPORT', '태초', '유일').tuneSetPoints, [145])
  assert.deepEqual(variantOf(SHADOW_SET, 'EARRING', '태초', '유일').tuneSetPoints, [145])
  assert.deepEqual(variantOf(SHADOW_SET, 'RING', '태초', '유일').tuneSetPoints, [265])
})

test('findEquipmentVariant는 대표 itemId를 세트, 부위, 선택지로 찾고 유일 장비는 세트 없이 찾는다', () => {
  const epic = findEquipmentVariant('712eef49bfaeef17d21b4d984b6c28b0')

  assert.equal(epic?.setItemId, SHADOW_SET)
  assert.equal(epic?.slotId, 'JACKET')
  assert.equal(epic?.variant.item.itemName, '짙은 그림자를 입은 죽음 상의')

  const exalted = findEquipmentVariant('aa5273499f19ddba846919dbb6857d82')

  assert.equal(exalted?.setItemId, null)
  assert.equal(exalted?.slotId, 'RING')
  assert.equal(exalted?.variant.item.itemName, '광휘를 머금은 눈동자')
  assert.equal(findEquipmentVariant('00000000000000000000000000000000'), null)
})

test('공용 이름 아이템은 방어구는 축성, 악세서리는 태초, 특수장비는 에픽 선택지로 찾는다', () => {
  for (const [itemId, slotId, rarity, kind, itemName] of [
    [
      'ce653434e129a67945878c1c2e66ce73',
      'JACKET',
      '에픽',
      '축성',
      '축성 : 짙은 그림자를 입은 죽음 상의'
    ],
    [
      '10cae409f5fbd9f31f1b7e565cdb7be4',
      'AMULET',
      '태초',
      '일반',
      '칠흑같은 그림자 속 목걸이 - 혈'
    ],
    ['de2811a96fe646281ade2ea28317f2c3', 'SUPPORT', '에픽', '일반', '짙은 그림자 속 보조장비 - 예']
  ]) {
    const match = findEquipmentVariant(itemId)

    assert.equal(match?.setItemId, SHADOW_SET, itemId)
    assert.equal(match?.slotId, slotId, itemId)
    assert.equal(match?.variant.rarity, rarity, itemId)
    assert.equal(match?.variant.kind, kind, itemId)
    assert.equal(match?.variant.item.itemName, itemName, itemId)
  }
})

test('공용 이름 아이템은 세트마다 itemId가 달라 각자 그 세트의 선택지로 찾는다', () => {
  for (const { setItemName, slotId, itemName, itemIds } of observed.items) {
    if (SHARED_NAMES.includes(itemName)) {
      const match = findEquipmentVariant(itemIds[0].itemId)

      assert.equal(match?.setItemId, observed.setItemIds[setItemName], `${setItemName} ${itemName}`)
      assert.equal(match?.slotId, slotId, `${setItemName} ${itemName}`)
      assert.equal(match?.variant.consecrated?.itemName, itemName, `${setItemName} ${itemName}`)
    }
  }
})

// 멈춘 차원 속의 이야기 상의는 같은 이름에 itemId가 셋이고, 관측한 착용 캐릭터 수는 47, 18, 1명 순이다.
test('같은 이름에 itemId가 여럿이면 착용이 가장 많은 itemId가 선택지 id와 대표 아이템이 되고 나머지도 같은 선택지로 찾는다', () => {
  const jacket = variantOf(DIMENSION_SET, 'JACKET', '유니크', '일반')

  assert.equal(jacket.id, '1aa88d350c4d1885c2157e91b2cf7dae')
  assert.equal(jacket.item.itemId, '1aa88d350c4d1885c2157e91b2cf7dae')
  for (const itemId of [
    '1aa88d350c4d1885c2157e91b2cf7dae',
    '2e46099362dcd059c1139fb3962333ee',
    '37389cde4cf790d33cbb55989811623c'
  ]) {
    assert.equal(findEquipmentVariant(itemId)?.variant, jacket, itemId)
  }
})

test('관측 자료의 itemId는 모두 선택지로 찾는다', () => {
  const missing = observed.items.flatMap(({ itemIds }) =>
    itemIds.map(({ itemId }) => itemId).filter((itemId) => findEquipmentVariant(itemId) === null)
  )

  assert.deepEqual(missing, [])
})

const allConsecrated = {
  JACKET: ['에픽', '축성'],
  SHOULDER: ['에픽', '축성'],
  PANTS: ['에픽', '축성'],
  SHOES: ['에픽', '축성'],
  WAIST: ['에픽', '축성']
}

test('방어구 5부위가 모두 축성이면 방어구, 태초 일반 악세서리, 에픽 일반 특수장비를 공용 이름 아이템으로 계산한다', () => {
  const selection = selectionOf(SHADOW_SET, {
    ...allConsecrated,
    AMULET: ['태초', '일반'],
    WRIST: ['태초', '흑아'],
    RING: ['에픽', '일반'],
    SUPPORT: ['에픽', '일반'],
    MAGIC_STON: ['에픽', '일반'],
    EARRING: ['태초', '유일']
  })

  assert.deepEqual(itemNamesOf(resolveEquipmentItems(selection)), {
    JACKET: '긍휼 속 자비의 상의',
    SHOULDER: '숭고한 심판의 어깨',
    PANTS: '명예로운 공경의 하의',
    SHOES: '고요한 안식의 신발',
    WAIST: '완전한 침묵의 벨트',
    AMULET: '성스러운 믿음의 목걸이',
    WRIST: '흑아 : 칠흑같은 그림자 속 팔찌 - 화',
    RING: '짙은 그림자 속 반지 - 독',
    SUPPORT: '초연한 청렴의 보조장비',
    MAGIC_STON: '무결한 순수의 마법석',
    EARRING: '영롱한 날씨의 큐브'
  })
  assert.equal(resolveEquipmentItems(selection).JACKET?.itemId, 'ce653434e129a67945878c1c2e66ce73')
})

test('공용 이름 아이템을 낀 부위에서 방어구 하나를 축성이 아니게 바꾸면 축성 : 아이템과 세트 이름 아이템으로 되돌린다', () => {
  const worn = Object.fromEntries(
    [
      ['JACKET', 'ce653434e129a67945878c1c2e66ce73'],
      ['WAIST', '6195206e63ffc979e7cd8c0ae01ebfd3'],
      ['AMULET', '10cae409f5fbd9f31f1b7e565cdb7be4'],
      ['SUPPORT', 'de2811a96fe646281ade2ea28317f2c3']
    ].map(([slotId, itemId]) => [slotId, findEquipmentVariant(itemId)?.variant])
  )
  const selection = {
    ...worn,
    ...selectionOf(SHADOW_SET, {
      SHOULDER: ['에픽', '축성'],
      PANTS: ['에픽', '축성'],
      SHOES: ['에픽', '잠식']
    })
  }

  assert.deepEqual(itemNamesOf(resolveEquipmentItems(selection)), {
    JACKET: '축성 : 짙은 그림자를 입은 죽음 상의',
    SHOULDER: '축성 : 짙은 그림자가 드리운 얼굴',
    PANTS: '축성 : 짙은 그림자를 녹여내는 하의',
    SHOES: '잠식 : 짙은 그림자의 걸음',
    WAIST: '축성 : 짙은 그림자를 자아내는 벨트',
    AMULET: '칠흑같은 그림자 속 목걸이 - 혈',
    SUPPORT: '짙은 그림자 속 보조장비 - 예'
  })
})

test('방어구가 비어 있는 부위가 있으면 5축성이 아니다', () => {
  const { WAIST: _waist, ...fourArmor } = allConsecrated
  const items = resolveEquipmentItems(selectionOf(SHADOW_SET, fourArmor))

  assert.equal(items.JACKET?.itemName, '축성 : 짙은 그림자를 입은 죽음 상의')
  assert.equal(items.WAIST, undefined)
})

test('5축성의 공용 이름 아이템은 부위마다 고른 선택지의 세트에서 고른다', () => {
  const selection = {
    ...selectionOf(SHADOW_SET, allConsecrated),
    JACKET: variantOf(SOUL_FAIRY_SET, 'JACKET', '에픽', '축성')
  }
  const items = resolveEquipmentItems(selection)

  assert.equal(items.JACKET?.itemName, '긍휼 속 자비의 상의')
  assert.equal(items.JACKET?.itemId, selection.JACKET.consecrated.itemId)
  assert.notEqual(items.JACKET?.itemId, 'ce653434e129a67945878c1c2e66ce73')
})

test('findOathCrystal은 서약 결정 이름으로 조율 단계별 세트 포인트를 돌려준다', () => {
  assert.deepEqual(findOathCrystal('그림자 : 완전한 광휘 결정'), {
    name: '그림자 : 완전한 광휘 결정',
    rarity: '에픽',
    tuneSetPoints: [165, 175, 185, 195]
  })
  assert.deepEqual(findOathCrystal('그림자 : 태초의 광휘 결정')?.tuneSetPoints, [205])
  assert.deepEqual(findOathCrystal('미광의 서약 결정')?.tuneSetPoints, [45, 55, 65, 75])
  assert.deepEqual(findOathCrystal('무의식의 안개 결정 35')?.tuneSetPoints, [125])
  assert.equal(findOathCrystal('없는 결정'), null)
})
