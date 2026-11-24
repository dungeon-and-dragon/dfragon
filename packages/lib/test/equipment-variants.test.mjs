import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  EQUIPMENT_VARIANT_SLOTS,
  equipmentVariantsOf,
  findEquipmentVariant,
  equipmentSets,
  findOathCrystal,
  findOathCrystalVariant,
  findOathUpgradeOption,
  findOathVariant,
  isValidOathUpgrade,
  OATH_UPGRADE_MAX_STEP,
  oathUpgradeSteps,
  moveOathCrystalToSet,
  oathCrystalVariantsOf,
  oathSets,
  oathVariantOf,
  oathVariantsOf,
  resolveEquipmentItems,
  switchEquipmentSet,
  findWeaponVariant,
  WEAPON_RELEASE_MAX,
  weaponItemOf,
  weaponMaxTuneLevelOf,
  weaponVariantsOf
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

function variantNamesOf(selection) {
  return Object.fromEntries(
    Object.entries(selection).map(([slotId, variant]) => [slotId, variant?.item.itemName ?? null])
  )
}

test('장비 세트 목록은 13개 세트의 setItemId와 이름이다', () => {
  const sets = equipmentSets()

  assert.equal(sets.length, 13)
  assert.deepEqual(
    sets.find(({ setItemId }) => setItemId === DIMENSION_SET),
    { setItemId: DIMENSION_SET, setItemName: '차원 속의 이야기 세트' }
  )
  assert.deepEqual(
    sets.find(({ setItemId }) => setItemId === SOUL_FAIRY_SET),
    { setItemId: SOUL_FAIRY_SET, setItemName: '소울 페어리 세트' }
  )
})

test('switchEquipmentSet은 부위마다 같은 등급, 같은 종류로 옮기고 잠식, 축성, 흑아를 유지한다', () => {
  const selection = selectionOf(SHADOW_SET, {
    JACKET: ['에픽', '축성'],
    SHOES: ['에픽', '잠식'],
    AMULET: ['태초', '흑아'],
    WRIST: ['태초', '일반'],
    SUPPORT: ['레전더리', '일반']
  })

  assert.deepEqual(variantNamesOf(switchEquipmentSet(selection, SOUL_FAIRY_SET)), {
    JACKET: '축성 : 노블 페어리 상의',
    SHOES: '잠식 : 노블 페어리 신발',
    AMULET: '흑아 : 로열 페어리 목걸이',
    WRIST: '로열 페어리 팔찌',
    SUPPORT: '엘더 페어리 보조장비'
  })
})

test('switchEquipmentSet은 유일 장비와 선택지에 없는 착용 아이템을 그대로 두라는 뜻으로 null을 돌려준다', () => {
  const selection = {
    ...selectionOf(SHADOW_SET, { JACKET: ['유니크', '일반'], EARRING: ['태초', '유일'] }),
    RING: null
  }

  assert.deepEqual(variantNamesOf(switchEquipmentSet(selection, SOUL_FAIRY_SET)), {
    JACKET: '리틀 페어리 상의',
    RING: null,
    EARRING: null
  })
})

test('차원 속의 이야기 세트로 옮기면 그 세트에 없는 등급은 가장 높은 레전더리로 바꾼다', () => {
  const selection = selectionOf(SHADOW_SET, {
    JACKET: ['에픽', '잠식'],
    SHOES: ['유니크', '일반'],
    AMULET: ['태초', '흑아'],
    SUPPORT: ['에픽', '일반']
  })

  assert.deepEqual(variantNamesOf(switchEquipmentSet(selection, DIMENSION_SET)), {
    JACKET: '흐르는 차원 속의 이야기 상의',
    SHOES: '멈춘 차원 속의 이야기 신발',
    AMULET: '흐르는 차원 속의 이야기 목걸이',
    SUPPORT: '흐르는 차원 속의 이야기 보조장비'
  })
})

test('switchEquipmentSet은 없는 세트로 옮기면 오류를 던진다', () => {
  assert.throws(() => switchEquipmentSet({}, 'missing-set'), /Unknown equipment set/)
})

test('서약 세트는 setId 16201~16212의 12개다', () => {
  const sets = oathSets()

  assert.deepEqual(
    sets.map(({ setId }) => setId),
    [16201, 16202, 16203, 16204, 16205, 16206, 16207, 16208, 16209, 16210, 16211, 16212]
  )
  assert.deepEqual(sets[0], { setId: 16201, name: '어둠에 잠긴 그림자 서약' })
  assert.deepEqual(sets[11], { setId: 16212, name: '경계의 마력 서약' })
})

test('세트 전용 서약 본체는 그 서약 세트의 4등급 가운데 고른다', () => {
  assert.deepEqual(
    oathVariantsOf(16210).map(({ rarity, item, setPoint }) => [rarity, item.itemName, setPoint]),
    [
      ['유니크', '기운이 감도는 여우 서약', 265],
      ['레전더리', '부름에 이끌린 여우 서약', 355],
      ['에픽', '빙의된 여우 서약', 455],
      ['태초', '강림한 여우 서약', 655]
    ]
  )
  assert.equal(oathVariantOf(16212, '에픽')?.id, '774dcc27d90a1d2bcd9b129ca6a45f7a')
  assert.deepEqual(oathVariantsOf(99999), [])
  assert.equal(oathVariantOf(16212, '레어'), null)
})

test('영겁의 안개 서약은 세트 없이 등급마다 다른 itemId로 4등급을 고른다', () => {
  assert.deepEqual(
    oathVariantsOf(null).map(({ id, rarity, setPoint }) => [rarity, id, setPoint]),
    [
      ['유니크', '79757c67d64623286761749ee6666b5f', 265],
      ['레전더리', '8b75878dd4e1904f1bfc131b52319bde', 355],
      ['에픽', '316e1b0f26a3a471be2a95e33a315171', 455],
      ['태초', 'ac0586536083d560b38659de8bc0c2b8', 655]
    ]
  )
})

test('findOathVariant는 본체 itemId로 서약 세트(안개 서약은 null)와 등급을 찾는다', () => {
  const shadow = findOathVariant('72adf78e645d9a821b9adcc98ef00044')
  const mist = findOathVariant('316e1b0f26a3a471be2a95e33a315171')

  assert.equal(shadow?.setId, 16201)
  assert.equal(shadow?.variant.rarity, '태초')
  assert.equal(shadow?.variant.item.itemName, '태초의 어둠 속 그림자 서약')
  assert.equal(mist?.setId, null)
  assert.equal(mist?.variant.rarity, '에픽')
  assert.equal(mist?.variant.item.itemName, '영겁의 안개 서약')
  // 레어 안개 서약은 엔진 서약 표에 없어 선택지가 아니다.
  assert.equal(findOathVariant('c7c70b8a2e3233d84256e6783649ce34'), null)
})

test('광휘 결정은 서약 세트마다 희미한, 선명한, 완전한, 태초의 4등급이고 태초는 조율하지 않는다', () => {
  assert.deepEqual(
    oathCrystalVariantsOf(16212).map(({ rarity, item, tuneSetPoints }) => [
      rarity,
      item.itemName,
      tuneSetPoints
    ]),
    [
      ['유니크', '마력 : 희미한 광휘 결정', [85, 95, 105, 115]],
      ['레전더리', '마력 : 선명한 광휘 결정', [125, 135, 145, 155]],
      ['에픽', '마력 : 완전한 광휘 결정', [165, 175, 185, 195]],
      ['태초', '마력 : 태초의 광휘 결정', [205]]
    ]
  )
})

test('findOathCrystalVariant는 광휘 결정의 서약 세트와 등급을 찾고 광휘 결정이 아니면 null이다', () => {
  const crystal = findOathCrystalVariant('5fe3c29985f15b1fdafd4c4d6a247839')

  assert.equal(crystal?.setId, 16201)
  assert.equal(crystal?.variant.rarity, '태초')
  assert.equal(crystal?.variant.item.itemName, '그림자 : 태초의 광휘 결정')
  assert.equal(findOathCrystalVariant('f834b16af8341719efe94a3be49d381e'), null)
})

test('moveOathCrystalToSet은 광휘 결정을 다른 서약 세트의 같은 등급으로 옮기고 광휘 결정이 아니면 null이다', () => {
  assert.equal(
    moveOathCrystalToSet('5f722339a3f5c7ef9ba0b290873e19f1', 16210)?.item.itemName,
    '여우 : 완전한 광휘 결정'
  )
  assert.equal(
    moveOathCrystalToSet('5fe3c29985f15b1fdafd4c4d6a247839', 16212)?.id,
    '0b991785c50799890f4b1821c309d39c'
  )
  assert.equal(moveOathCrystalToSet('f834b16af8341719efe94a3be49d381e', 16212), null)
  assert.throws(
    () => moveOathCrystalToSet('5f722339a3f5c7ef9ba0b290873e19f1', 99999),
    /Unknown oath set/
  )
})

test('findOathCrystal은 광휘 결정 밖의 결정도 이름으로 조율 포인트를 그대로 찾는다', () => {
  assert.deepEqual(findOathCrystal('여우 : 태초의 광휘 결정')?.tuneSetPoints, [205])
  assert.deepEqual(findOathCrystal('희미한 안개 결정')?.tuneSetPoints, [85])
})

test('무기 조율은 이름마다 상한이 있고, 목록에 없는 무기는 조율할 수 없다', () => {
  assert.equal(weaponMaxTuneLevelOf('Beast-Saw'), 3)
  assert.equal(weaponMaxTuneLevelOf('짙은 심연의 편린 블레이드 : 살의의 파동'), 0)
  assert.equal(weaponMaxTuneLevelOf('constructor'), 0)
})

// 엔진 weaponTune은 넨 스텔라를 0~5단계로 적지만 무기 단계 목록(weapons)은 0~3단계다.
test('115레벨 무기의 조율 상한은 무기 단계 목록을 따르고, 해방 계열과 조율을 마친 무기는 조율할 수 없다', () => {
  assert.equal(weaponMaxTuneLevelOf('넨 스텔라'), 3)
  assert.equal(weaponMaxTuneLevelOf('찢어지는 비명의 메아리'), 0)
  assert.equal(weaponMaxTuneLevelOf('검은 질병의 특형 - 호위무신의 운검'), 0)
})

const GREATSWORD = {
  unique: '9130e71576b60ef9c620d4b5f8825755',
  legendary: 'd978ce202804d10c1970bab4b46accd8',
  legendaryStar: '8215605516a956285743aff73aeb28ca',
  epic: '49d73ddb4974cc8ee23c0da2e253cf2a',
  epicStar: 'ea202d77351094e11332f2aa8ece0d48',
  primeval: 'f4ebda346ccd4281a9c37de9cb8936a5',
  tuned: 'd0bd701ea42d1e6ee03ae7e4c77faa09',
  release: '91334afd67ca965ff4ed8dab5c4b2352',
  releasePending: '79c52fac4c9b4bb5d70d2c5880454060',
  primevalStar: '9f0dde7a9c78384a9c5a80ff41f98e68'
}

function weaponVariantOf(itemTypeDetail, itemId) {
  const found = weaponVariantsOf(itemTypeDetail).find(({ id }) => id === itemId)

  assert.ok(found, `${itemTypeDetail} ${itemId}`)

  return found
}

test('무기 선택지는 종류마다 엔진 목록 순서로 두고, 조율을 마친 아이템은 태초 기본 바로 뒤에 둔다', () => {
  const variants = weaponVariantsOf('대검').map(({ rarity, line, tuned, maxTuneLevel, item }) => [
    rarity,
    line,
    tuned,
    maxTuneLevel,
    item.itemName
  ])

  assert.deepEqual(variants, [
    ['유니크', null, false, 3, '유일무이한 대검'],
    ['레전더리', '기본', false, 3, '제1형 - 공식, 필중의 운검'],
    ['레전더리', '태초의 별', false, 3, '전설 속의 전승 - 대검'],
    ['에픽', '기본', false, 3, '제2형 - 수식, 방어의 운검'],
    ['에픽', '태초의 별', false, 3, '서사시의 영웅담 - 대검'],
    ['태초', '기본', false, 3, '특형 - 호위무신의 운검'],
    ['태초', '기본', true, 0, '검은 질병의 특형 - 호위무신의 운검'],
    ['태초', '해방', false, 0, '찢어지는 비명의 메아리'],
    ['태초', '태초의 별', false, 3, '태초의 별 - 대검']
  ])
  assert.deepEqual(
    weaponVariantsOf('대검').map(({ id }) => id),
    Object.values(GREATSWORD).filter((itemId) => itemId !== GREATSWORD.releasePending)
  )
})

test('itemId를 찾지 못한 "전설 속의 전승 - 쌍검"은 쌍검 선택지에서 빠진다', () => {
  const dualSwordNames = weaponVariantsOf('쌍검').map(({ item }) => item.itemName)

  assert.equal(table.weapons.length, 43)
  assert.equal(dualSwordNames.length, 8)
  assert.equal(dualSwordNames.includes('전설 속의 전승 - 쌍검'), false)
})

test('해방 계열 선택지는 해방 아이템을 대표로 두고 "억압 - " 아이템을 함께 가진다', () => {
  const release = weaponVariantOf('대검', GREATSWORD.release)

  assert.deepEqual(release.item, {
    itemId: GREATSWORD.release,
    itemName: '찢어지는 비명의 메아리',
    itemRarity: '태초'
  })
  assert.deepEqual(release.releasePending, {
    itemId: GREATSWORD.releasePending,
    itemName: '억압 - 찢어지는 비명의 메아리',
    itemRarity: '태초'
  })
  assert.equal(weaponVariantOf('대검', GREATSWORD.primeval).releasePending, undefined)
})

test('findWeaponVariant는 무기 종류와 선택지를 찾고 "억압 - " 아이템은 해방 선택지로 찾는다', () => {
  const release = weaponVariantOf('대검', GREATSWORD.release)
  const tuned = weaponVariantOf('대검', GREATSWORD.tuned)

  assert.deepEqual(findWeaponVariant(GREATSWORD.release), {
    itemTypeDetail: '대검',
    variant: release
  })
  assert.deepEqual(findWeaponVariant(GREATSWORD.releasePending), {
    itemTypeDetail: '대검',
    variant: release
  })
  assert.deepEqual(findWeaponVariant(GREATSWORD.tuned), { itemTypeDetail: '대검', variant: tuned })
  assert.equal(findWeaponVariant(SHADOW_SET), null)
  assert.deepEqual(weaponVariantsOf('없는 종류'), [])
})

test('관측 자료의 무기 itemId는 모두 선택지로 찾는다', () => {
  const missing = observed.weapons.flatMap(({ itemIds }) =>
    itemIds.map(({ itemId }) => itemId).filter((itemId) => findWeaponVariant(itemId) === null)
  )

  assert.deepEqual(missing, [])
})

test('weaponItemOf는 해방 수치 100이면 해방 아이템, 100 미만이면 "억압 - " 아이템이고 해방 계열이 아니면 대표 아이템이다', () => {
  const release = weaponVariantOf('대검', GREATSWORD.release)
  const star = weaponVariantOf('대검', GREATSWORD.primevalStar)

  assert.equal(WEAPON_RELEASE_MAX, 100)
  assert.equal(weaponItemOf(release, 100).itemId, GREATSWORD.release)
  assert.equal(weaponItemOf(release, 99).itemId, GREATSWORD.releasePending)
  assert.equal(weaponItemOf(release, 0).itemId, GREATSWORD.releasePending)
  assert.equal(weaponItemOf(star, 0).itemId, GREATSWORD.primevalStar)
})

const OATH_UPGRADE_OPTIONS = [
  ['강인한 통찰', '고요한 호흡', '깨어난 서약'],
  ['포용의 권능', '자애의 마음', '자비의 맹세'],
  ['심연의 고동', '내면의 조율', '영혼의 계약'],
  ['신념의 대가', '경계의 인내', '구원의 언약'],
  ['이어진 걸음', '숭고한 동행', '결의의 공명'],
  ['영원의 궤적', '불변의 약속', '본질의 선언'],
  ['만물의 흐름', '바래온 구원', '자각의 파동'],
  ['순례자의 길', '맞잡은 구원', '남겨진 온기'],
  ['진리 도달', '완성된 의지', '만개하는 빛']
]

function upgradesOf(stepCount) {
  return OATH_UPGRADE_OPTIONS.slice(0, stepCount).map(([option], index) => ({
    step: index + 1,
    option
  }))
}

test('묵언의 진의는 1~9단계이고 단계마다 선택지가 셋이다', () => {
  const steps = oathUpgradeSteps()

  assert.equal(OATH_UPGRADE_MAX_STEP, 9)
  assert.deepEqual(
    steps.map(({ step }) => step),
    [1, 2, 3, 4, 5, 6, 7, 8, 9]
  )
  assert.deepEqual(
    steps.map(({ options }) => options.map(({ option }) => option)),
    OATH_UPGRADE_OPTIONS
  )
  assert.equal(steps[0].name, '<묵언의 진의> - 첫 번째 진의')
  assert.equal(steps[8].name, '<묵언의 진의> - 아홉 번째 진의')
})

test('1~4단계 선택지는 데미지, 쿨타임, 서약 포인트이고 5~9단계는 속도, 스킬 범위, 피해 감소다', () => {
  const kinds = oathUpgradeSteps().map(({ options }) => options.map(({ kind }) => kind))
  const early = ['Damage', 'Cooltime', 'Oathpoint']
  const late = ['Speed', 'SkillRange', 'DamageReduce']

  assert.deepEqual(kinds, [early, early, early, early, late, late, late, late, late])
})

test('findOathUpgradeOption은 그 단계의 선택지만 찾는다', () => {
  assert.deepEqual(findOathUpgradeOption(4, '구원의 언약'), {
    option: '구원의 언약',
    kind: 'Oathpoint'
  })
  assert.equal(findOathUpgradeOption(5, '구원의 언약'), null)
  assert.equal(findOathUpgradeOption(10, '진리 도달'), null)
})

test('isValidOathUpgrade는 1단계부터 이어지고 9단계 이하이며 단계마다 그 단계의 선택지인 목록만 받는다', () => {
  assert.equal(isValidOathUpgrade([]), true)
  assert.equal(isValidOathUpgrade(upgradesOf(3)), true)
  assert.equal(isValidOathUpgrade(upgradesOf(9)), true)
  assert.equal(
    isValidOathUpgrade([
      { step: 1, option: '강인한 통찰' },
      { step: 3, option: '심연의 고동' }
    ]),
    false
  )
  assert.equal(isValidOathUpgrade([{ step: 2, option: '포용의 권능' }]), false)
  assert.equal(isValidOathUpgrade([...upgradesOf(9), { step: 10, option: '진리 도달' }]), false)
  assert.equal(
    isValidOathUpgrade([
      { step: 1, option: '강인한 통찰' },
      { step: 2, option: '심연의 고동' }
    ]),
    false
  )
})

test('스위칭 구획은 버프 강화 장비 칸의 상한 12와 유니크 스위칭 장비 이름의 접두어 둘을 가진다', () => {
  assert.deepEqual(table.switching, {
    maxEquipment: 12,
    uniqueEquipmentPrefixes: ['짙은 심연의 편린 ', '짙은 뒤틀린 심연의 ']
  })
})
