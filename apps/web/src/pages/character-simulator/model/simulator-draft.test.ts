import { type EnchantGradeSlot, enchantOptionsOf } from '@dfragon/lib/enchant-grades'
import { type EquipmentVariantSlot, equipmentVariantsOf } from '@dfragon/lib/equipment-variants'
import { slotItemsOf } from '@dfragon/lib/slot-items'
import { expect, it } from 'vitest'
import type { CharacterDetailView } from '#entities/character'
import { characterDetailFixture } from '#entities/character/api/character-detail.fixture'
import {
  draftOf,
  hasChanges,
  NO_CHANGES,
  resolvedItemsOf,
  rowsInEquipmentSet,
  type SimulatorAction,
  type SimulatorChanges,
  type SimulatorRow,
  type SimulatorSlot,
  type SimulatorSlotItem,
  type SimulationChange,
  simulationBody,
  simulatorReducer,
  slotItemChoiceOf,
  toEquipmentSet,
  toSimulatorRows,
  TUNED_WEAPON_NAME,
  tuneLimitOf
} from './simulator-draft'
import { toSimulatorSwitching } from './simulator-switching'

const GRADE_SLOTS = [
  'WEAPON',
  'JACKET',
  'SHOULDER',
  'PANTS',
  'SHOES',
  'WAIST',
  'AMULET',
  'WRIST',
  'RING',
  'SUPPORT',
  'MAGIC_STON',
  'EARRING'
]

// 딜러 fixture는 소울 페어리 세트의 5축성 공용 이름 아이템을, 버퍼 fixture는 에테리얼 오브 아츠 세트와 세트 밖 고유 팔찌를 낀다.
const SOUL_FAIRY_SET = '4ee7bd5912cda6e2a24c1f36d5202b46'
const SHADOW_SET = '3af7c961e7d8cd8b5b42c5f82af2a0ad'
const ETHEREAL_SET = '93e7825053bdec4e0f4c12837cf4f57e'
const EXALTED_RING_ID = 'aa5273499f19ddba846919dbb6857d82'
const UNCHANGED_ITEM = { enchantId: null, variantId: null, tune: 0, potency: null, release: null }
const KEPT_ITEM = { variantId: null, tune: null, potency: null, release: null }
// 딜러 fixture는 낫 해방 계열의 해방 수치 100 무기(재앙의 송곳니)를 낀다.
const SCYTHE_RELEASE = '89c42c1d02e6749244ce518e9b34e1c7'
const WORN_WEAPON = { variantId: SCYTHE_RELEASE, release: 100 }

function variantOf(setItemId: string, slotId: EquipmentVariantSlot, rarity: string, kind: string) {
  const found = equipmentVariantsOf(setItemId, slotId).find(
    (variant) => variant.rarity === rarity && variant.kind === kind
  )
  expect(found, `${slotId} ${rarity} ${kind}`).toBeDefined()

  return found!
}

function withItem(
  detail: CharacterDetailView,
  slotId: string,
  item: Partial<CharacterDetailView['equipment']['equipment'][number]>
): CharacterDetailView {
  const equipment = detail.equipment.equipment.map((current) =>
    current.slotId === slotId ? { ...current, ...item } : current
  )

  return { ...detail, equipment: { ...detail.equipment, equipment } }
}

function slotsOf(rows: readonly SimulatorRow[]): SimulatorSlot[] {
  return rows.flatMap((row) => {
    if (row.kind !== 'equipment') {
      return []
    }

    return [row.slot]
  })
}

function slotItemsIn(rows: readonly SimulatorRow[]): SimulatorSlotItem[] {
  return rows.flatMap((row) => {
    if (row.kind !== 'slotItem') {
      return []
    }

    return [row.slotItem]
  })
}

function slotOf(slots: readonly SimulatorSlot[], slotId: EnchantGradeSlot): SimulatorSlot {
  const slot = slots.find((candidate) => candidate.slotId === slotId)
  expect(slot, slotId).toBeDefined()

  return slot!
}

function apply(changes: SimulatorChanges, ...actions: SimulatorAction[]): SimulatorChanges {
  return actions.reduce(simulatorReducer, changes)
}

function firstOptionId(slotId: EnchantGradeSlot, role: 'dealer' | 'buffer'): string {
  const { 종결, 준종결 } = enchantOptionsOf(slotId, role)
  const option = [...종결, ...준종결][0]
  expect(option, `${slotId} ${role}`).toBeDefined()

  return option!.id
}

const dealerRows = toSimulatorRows(characterDetailFixture('dealer'))
const dealerSlots = slotsOf(dealerRows)
const weapon = slotOf(dealerSlots, 'WEAPON')
const amulet = slotOf(dealerSlots, 'AMULET')

it('장비 12부위를 응답 순서대로 두고, 착용한 수치와 강화, 증폭을 기본값으로 둔다', () => {
  expect(dealerSlots.map(({ slotId }) => slotId)).toEqual(GRADE_SLOTS)
  expect(draftOf(weapon, NO_CHANGES)).toEqual({
    ...UNCHANGED_ITEM,
    ...WORN_WEAPON,
    reinforce: 10,
    amplified: false
  })
  expect(draftOf(slotOf(dealerSlots, 'EARRING'), NO_CHANGES)).toEqual({
    ...UNCHANGED_ITEM,
    reinforce: 8,
    amplified: true,
    variantId: variantOf(SOUL_FAIRY_SET, 'EARRING', '에픽', '일반').id
  })
  expect(simulationBody(dealerRows, null, NO_CHANGES)).toEqual({ equipment: [] })
})

it('버퍼의 0 증폭 장비는 증폭으로 두고, 마법부여 목록은 버퍼 등급표에서만 고른다', () => {
  const bufferSlots = slotsOf(toSimulatorRows(characterDetailFixture('buffer')))
  const jacket = slotOf(bufferSlots, 'JACKET')
  const bufferIds = Object.values(enchantOptionsOf('JACKET', 'buffer'))
    .flat()
    .map(({ id }) => id)

  expect(draftOf(jacket, NO_CHANGES)).toEqual({
    ...UNCHANGED_ITEM,
    reinforce: 0,
    amplified: true,
    variantId: variantOf(ETHEREAL_SET, 'JACKET', '레전더리', '일반').id
  })
  expect(jacket.enchantChoices.map(({ id }) => id)).toEqual(bufferIds)
  expect(jacket.enchantChoices.length).toBeGreaterThan(0)
})

it('바꾼 부위만 그 부위의 원하는 상태 전체로 요청 body에 넣고, 원래 값으로 되돌리면 뺀다', () => {
  const enchantId = firstOptionId('AMULET', 'dealer')
  const changed = apply(
    NO_CHANGES,
    { type: 'change', slot: amulet, draft: { enchantId } },
    { type: 'change', slot: weapon, draft: { reinforce: 12 } },
    { type: 'change', slot: weapon, draft: { amplified: true } }
  )

  expect(simulationBody(dealerRows, null, changed)).toEqual({
    equipment: [
      { ...KEPT_ITEM, slotId: 'WEAPON', reinforce: 12, amplified: true, enchantId: null },
      { ...KEPT_ITEM, slotId: 'AMULET', reinforce: 0, amplified: false, enchantId }
    ]
  })

  const restored = apply(
    changed,
    { type: 'change', slot: weapon, draft: { reinforce: 10, amplified: false } },
    { type: 'change', slot: amulet, draft: { enchantId: null } }
  )

  expect(restored).toEqual(NO_CHANGES)
})

it('초기화하면 바꾼 부위가 모두 원래대로 돌아간다', () => {
  const changed = apply(NO_CHANGES, { type: 'change', slot: weapon, draft: { reinforce: 15 } })

  expect(apply(changed, { type: 'reset' })).toEqual(NO_CHANGES)
})

it('수치는 +0부터 +20까지 받고, 20을 넘는 장비는 지금 수치까지 받는다', () => {
  const overLimit = slotOf(
    slotsOf(
      toSimulatorRows(withItem(characterDetailFixture('dealer'), 'WEAPON', { reinforce: 23 }))
    ),
    'WEAPON'
  )

  expect(weapon.reinforceLimit).toBe(20)
  expect(overLimit.reinforceLimit).toBe(23)
  expect(
    draftOf(weapon, apply(NO_CHANGES, { type: 'change', slot: weapon, draft: { reinforce: 20 } }))
  ).toEqual({ ...UNCHANGED_ITEM, ...WORN_WEAPON, reinforce: 20, amplified: false })
  expect(
    draftOf(weapon, apply(NO_CHANGES, { type: 'change', slot: weapon, draft: { reinforce: 0 } }))
  ).toEqual({ ...UNCHANGED_ITEM, ...WORN_WEAPON, reinforce: 0, amplified: false })
  expect(apply(NO_CHANGES, { type: 'change', slot: weapon, draft: { reinforce: 21 } })).toEqual(
    NO_CHANGES
  )
  expect(apply(NO_CHANGES, { type: 'change', slot: overLimit, draft: { reinforce: 24 } })).toEqual(
    NO_CHANGES
  )
  expect(apply(NO_CHANGES, { type: 'change', slot: weapon, draft: { reinforce: -1 } })).toEqual(
    NO_CHANGES
  )
  expect(
    draftOf(
      overLimit,
      apply(NO_CHANGES, { type: 'change', slot: overLimit, draft: { reinforce: 22 } })
    )
  ).toEqual({ ...UNCHANGED_ITEM, ...WORN_WEAPON, reinforce: 22, amplified: false })
})

it('표시가 같아 합친 묶음은 묶음 id로만 고르고 묶음의 다른 항목 id는 받지 않는다', () => {
  const merged = enchantOptionsOf('WEAPON', 'dealer').준종결.find(
    (option) => option.members.length > 1
  )
  expect(merged).toBeDefined()
  const [, other] = merged!.members

  expect(weapon.enchantChoices.map(({ id }) => id)).toContain(merged!.id)
  expect(
    draftOf(
      weapon,
      apply(NO_CHANGES, { type: 'change', slot: weapon, draft: { enchantId: merged!.id } })
    ).enchantId
  ).toBe(merged!.id)
  expect(
    apply(NO_CHANGES, { type: 'change', slot: weapon, draft: { enchantId: other!.id } })
  ).toEqual(NO_CHANGES)
})

it('등급표에 없는 마법부여는 받지 않는다', () => {
  const otherSlotId = firstOptionId('WEAPON', 'dealer')

  expect(
    apply(NO_CHANGES, { type: 'change', slot: amulet, draft: { enchantId: otherSlotId } })
  ).toEqual(NO_CHANGES)
})

it('115레벨이 아닌 장비는 수치와 강화, 증폭을 바꾸지 않고 마법부여만 바꾼다', () => {
  const detail = withItem(characterDetailFixture('dealer'), 'AMULET', { itemAvailableLevel: 110 })
  const oldAmulet = slotOf(slotsOf(toSimulatorRows(detail)), 'AMULET')
  const enchantId = firstOptionId('AMULET', 'dealer')
  const changed = apply(
    NO_CHANGES,
    { type: 'change', slot: oldAmulet, draft: { reinforce: 12 } },
    { type: 'change', slot: oldAmulet, draft: { amplified: true } },
    { type: 'change', slot: oldAmulet, draft: { enchantId } }
  )

  expect(oldAmulet.reinforceEditable).toBe(false)
  expect(weapon.reinforceEditable).toBe(true)
  expect(simulationBody([{ kind: 'equipment', slot: oldAmulet }], null, changed)).toEqual({
    equipment: [{ ...KEPT_ITEM, slotId: 'AMULET', reinforce: 0, amplified: false, enchantId }]
  })
})

const [title, creature, aura] = slotItemsIn(dealerRows)

it('칭호는 응답의 부위 자리에, 크리쳐와 오라는 장비 뒤에 두고 착용한 아이템과 선택 목록을 준다', () => {
  const order = dealerRows.map((row) => {
    if (row.kind === 'equipment') {
      return row.slot.slotId
    }

    return row.slotItem.category
  })

  expect(order).toEqual(['WEAPON', 'title', ...GRADE_SLOTS.slice(1), 'creature', 'aura'])
  expect(
    [title, creature, aura].map((slotItem) => [slotItem!.slotName, slotItem!.itemName])
  ).toEqual([
    ['칭호', '프로스트의 전설 플래티넘[35Lv]'],
    ['크리쳐', '운명을 담는 재단사'],
    ['오라', '고결한 영혼의 잔상']
  ])
  expect(title!.choices).toEqual(
    slotItemsOf('title').map(({ id, name, item }) => ({
      id,
      name,
      itemId: item.itemId,
      rarity: 'rare'
    }))
  )
  expect(slotItemChoiceOf(title!, NO_CHANGES)).toBeNull()
})

it('칭호, 크리쳐, 오라는 고른 것만 장비 변경과 함께 body에 넣고, 장비를 바꾸지 않았으면 빈 equipment로 보낸다', () => {
  const [titleItem] = slotItemsOf('title')
  const [, auraItem] = slotItemsOf('aura')
  const chosen = apply(
    NO_CHANGES,
    { type: 'slotItem', slotItem: title!, id: titleItem!.id },
    { type: 'slotItem', slotItem: aura!, id: auraItem!.id }
  )

  expect(slotItemChoiceOf(title!, chosen)).toBe(titleItem!.id)
  expect(simulationBody(dealerRows, null, chosen)).toEqual({
    equipment: [],
    title: titleItem!.id,
    aura: auraItem!.id
  })

  const withWeapon = apply(chosen, { type: 'change', slot: weapon, draft: { reinforce: 11 } })

  expect(simulationBody(dealerRows, null, withWeapon)).toEqual({
    equipment: [
      { ...KEPT_ITEM, slotId: 'WEAPON', reinforce: 11, amplified: false, enchantId: null }
    ],
    title: titleItem!.id,
    aura: auraItem!.id
  })
})

it('현재 아이템으로 되돌리거나 초기화하면 고른 칭호, 크리쳐, 오라를 지운다', () => {
  const [creatureItem] = slotItemsOf('creature')
  const chosen = apply(NO_CHANGES, { type: 'slotItem', slotItem: creature!, id: creatureItem!.id })

  expect(hasChanges(chosen)).toBe(true)
  expect(apply(chosen, { type: 'slotItem', slotItem: creature!, id: null })).toEqual(NO_CHANGES)
  expect(apply(chosen, { type: 'reset' })).toEqual(NO_CHANGES)
})

it('그 부위의 목록에 없는 id는 받지 않는다', () => {
  const [creatureItem] = slotItemsOf('creature')

  expect(apply(NO_CHANGES, { type: 'slotItem', slotItem: title!, id: creatureItem!.id })).toEqual(
    NO_CHANGES
  )
})

it('칭호, 크리쳐, 오라를 착용하지 않은 캐릭터는 그 행을 두지 않는다', () => {
  const detail = characterDetailFixture('dealer')
  const bare = {
    ...detail,
    equipment: {
      ...detail.equipment,
      equipment: detail.equipment.equipment.filter(({ slotId }) => slotId !== 'TITLE')
    },
    creature: null,
    avatar: detail.avatar.filter(({ slotId }) => slotId !== 'AURORA')
  }

  expect(slotItemsIn(toSimulatorRows(bare))).toEqual([])
  expect(slotsOf(toSimulatorRows(bare))).toHaveLength(12)
})

const bufferDetail = characterDetailFixture('buffer')
const bufferRows = toSimulatorRows(bufferDetail)
const bufferSlots = slotsOf(bufferRows)
const dealerJacket = slotOf(dealerSlots, 'JACKET')
const dealerSupport = slotOf(dealerSlots, 'SUPPORT')
const dealerEarring = slotOf(dealerSlots, 'EARRING')

function idsOf(variants: readonly { id: string }[]): string[] {
  return variants.map(({ id }) => id)
}

it('무기를 뺀 11부위는 낀 아이템 세트의 선택지를 두고, 낀 공용 이름 아이템은 그 선택지로 고른 상태다', () => {
  expect(idsOf(dealerJacket.variants)).toEqual(idsOf(equipmentVariantsOf(SOUL_FAIRY_SET, 'JACKET')))
  expect(dealerJacket.wornVariantId).toBe(variantOf(SOUL_FAIRY_SET, 'JACKET', '에픽', '축성').id)
  expect(amulet.wornVariantId).toBe(variantOf(SOUL_FAIRY_SET, 'AMULET', '태초', '일반').id)
  expect(idsOf(slotOf(dealerSlots, 'RING').variants)).toContain(EXALTED_RING_ID)
})

it('세트 밖 장비를 낀 부위는 주 세트의 선택지를 두고 착용 아이템은 선택지에 없는 착용 중 상태다', () => {
  const wrist = slotOf(bufferSlots, 'WRIST')

  expect(wrist.itemName).toBe('고유 - 모독자의 조소 팔찌')
  expect(idsOf(wrist.variants)).toEqual(idsOf(equipmentVariantsOf(ETHEREAL_SET, 'WRIST')))
  expect(wrist.wornVariantId).toBeNull()
  expect(draftOf(wrist, NO_CHANGES).variantId).toBeNull()
})

const [bufferSet] = bufferDetail.equipment.setItemInfo

function pointed(setItemId: string | null, current: number) {
  return {
    ...bufferSet!,
    setItemId,
    active: { setPoint: { current, min: null, max: null }, status: [] }
  }
}

function withSets(
  detail: CharacterDetailView,
  setItemInfo: CharacterDetailView['equipment']['setItemInfo']
): CharacterDetailView {
  return { ...detail, equipment: { ...detail.equipment, setItemInfo } }
}

it('주 세트는 세트 포인트와 setItemId가 모두 있는 세트 가운데 세트 포인트가 가장 큰 세트다', () => {
  const detail = withSets(bufferDetail, [
    pointed(null, 9_999),
    { ...bufferSet!, setItemId: SOUL_FAIRY_SET, active: null },
    pointed(ETHEREAL_SET, 100)
  ])
  const wrist = slotOf(slotsOf(toSimulatorRows(detail)), 'WRIST')

  expect(idsOf(wrist.variants)).toEqual(idsOf(equipmentVariantsOf(ETHEREAL_SET, 'WRIST')))
})

it('선택 목록에 없는 세트의 장비를 낀 부위는 세트 밖 장비처럼 선택 목록에 있는 주 세트의 선택지를 둔다', () => {
  const unlistedSet = 'unlisted-set'
  const detail = withSets(withItem(bufferDetail, 'WRIST', { setItemId: unlistedSet }), [
    pointed(unlistedSet, 9_999),
    pointed(ETHEREAL_SET, 100)
  ])
  const wrist = slotOf(slotsOf(toSimulatorRows(detail)), 'WRIST')

  expect(equipmentVariantsOf(unlistedSet, 'WRIST')).toEqual([])
  expect(idsOf(wrist.variants)).toEqual(idsOf(equipmentVariantsOf(ETHEREAL_SET, 'WRIST')))
  expect(wrist.wornVariantId).toBeNull()
})

it('세트 밖 유일 장비를 낀 부위는 주 세트의 선택지에서 유일 장비가 고른 상태이고 착용한 정밀도를 초기값으로 둔다', () => {
  const detail = withItem(characterDetailFixture('dealer'), 'RING', {
    itemId: EXALTED_RING_ID,
    itemName: '광휘를 머금은 눈동자',
    setItemId: null,
    potency: { value: '35%' }
  })
  const ring = slotOf(slotsOf(toSimulatorRows(detail)), 'RING')
  const epic = variantOf(SOUL_FAIRY_SET, 'RING', '에픽', '일반')
  const changed = apply(NO_CHANGES, { type: 'change', slot: ring, draft: { potency: 60 } })

  expect(idsOf(ring.variants)).toEqual(idsOf(equipmentVariantsOf(SOUL_FAIRY_SET, 'RING')))
  expect(draftOf(ring, NO_CHANGES)).toMatchObject({ variantId: EXALTED_RING_ID, potency: 35 })
  expect(simulationBody([{ kind: 'equipment', slot: ring }], null, changed).equipment).toEqual([
    { slotId: 'RING', reinforce: 0, amplified: false, enchantId: null, ...KEPT_ITEM, potency: 60 }
  ])

  const back = apply(
    changed,
    { type: 'change', slot: ring, draft: { variantId: epic.id } },
    { type: 'change', slot: ring, draft: { variantId: EXALTED_RING_ID } }
  )

  expect(draftOf(ring, back).potency).toBe(35)
  expect(back).toEqual(NO_CHANGES)
})

it('아이템을 바꿔도 수치, 증폭, 마법부여는 그대로 두고 조율은 바꾼 아이템이 조율할 수 있는 단계까지만 둔다', () => {
  const enchantId = firstOptionId('EARRING', 'dealer')
  const exalted = variantOf(SOUL_FAIRY_SET, 'EARRING', '태초', '유일')
  const legendary = variantOf(SOUL_FAIRY_SET, 'EARRING', '레전더리', '일반')
  const tuned = apply(
    NO_CHANGES,
    { type: 'change', slot: dealerEarring, draft: { enchantId } },
    { type: 'change', slot: dealerEarring, draft: { tune: 3 } },
    { type: 'change', slot: dealerEarring, draft: { variantId: legendary.id } }
  )

  expect(draftOf(dealerEarring, tuned)).toEqual({
    reinforce: 8,
    amplified: true,
    enchantId,
    variantId: legendary.id,
    tune: 3,
    potency: null,
    release: null
  })
  expect(
    draftOf(
      dealerEarring,
      apply(tuned, { type: 'change', slot: dealerEarring, draft: { variantId: exalted.id } })
    )
  ).toEqual({
    reinforce: 8,
    amplified: true,
    enchantId,
    variantId: exalted.id,
    tune: 0,
    potency: 100,
    release: null
  })
})

it('조율은 0단계부터 그 아이템의 단계까지만 받고, 조율할 수 없는 아이템과 무기는 받지 않는다', () => {
  expect(
    draftOf(
      dealerSupport,
      apply(NO_CHANGES, { type: 'change', slot: dealerSupport, draft: { tune: 3 } })
    ).tune
  ).toBe(3)
  expect(apply(NO_CHANGES, { type: 'change', slot: dealerSupport, draft: { tune: 4 } })).toEqual(
    NO_CHANGES
  )
  expect(apply(NO_CHANGES, { type: 'change', slot: amulet, draft: { tune: 1 } })).toEqual(
    NO_CHANGES
  )
  expect(apply(NO_CHANGES, { type: 'change', slot: weapon, draft: { tune: 1 } })).toEqual(
    NO_CHANGES
  )
})

it('정밀도는 유일 장비에서만 0부터 100까지 정수로 받는다', () => {
  const exalted = variantOf(SOUL_FAIRY_SET, 'EARRING', '태초', '유일')
  const chosen = apply(NO_CHANGES, {
    type: 'change',
    slot: dealerEarring,
    draft: { variantId: exalted.id }
  })

  expect(draftOf(dealerEarring, chosen).potency).toBe(100)
  expect(
    draftOf(
      dealerEarring,
      apply(chosen, { type: 'change', slot: dealerEarring, draft: { potency: 0 } })
    ).potency
  ).toBe(0)
  for (const potency of [101, -1, 50.5]) {
    expect(apply(chosen, { type: 'change', slot: dealerEarring, draft: { potency } })).toEqual(
      chosen
    )
  }
  expect(
    apply(NO_CHANGES, { type: 'change', slot: dealerSupport, draft: { potency: 50 } })
  ).toEqual(NO_CHANGES)
})

it('아이템, 조율, 정밀도를 바꾼 부위는 바꾼 값만 요청 body에 싣고 착용 아이템을 유지한 칸은 null로 둔다', () => {
  const corroded = variantOf(SOUL_FAIRY_SET, 'JACKET', '에픽', '잠식')
  const exalted = variantOf(SOUL_FAIRY_SET, 'EARRING', '태초', '유일')
  const changed = apply(
    NO_CHANGES,
    { type: 'change', slot: dealerJacket, draft: { variantId: corroded.id } },
    { type: 'change', slot: dealerSupport, draft: { tune: 2 } },
    { type: 'change', slot: dealerEarring, draft: { variantId: exalted.id } },
    { type: 'change', slot: dealerEarring, draft: { potency: 70 } }
  )
  const base = { reinforce: 0, amplified: false, enchantId: null }

  expect(simulationBody(dealerRows, null, changed)).toEqual({
    equipment: [
      { slotId: 'JACKET', ...base, variantId: corroded.id, tune: 0, potency: null, release: null },
      { slotId: 'SUPPORT', ...base, variantId: null, tune: 2, potency: null, release: null },
      {
        slotId: 'EARRING',
        reinforce: 8,
        amplified: true,
        enchantId: null,
        variantId: exalted.id,
        tune: 0,
        potency: 70,
        release: null
      }
    ]
  })
})

it('착용 아이템의 선택지나 착용 중 항목으로 되돌리면 그 부위를 요청에서 뺀다', () => {
  const wrist = slotOf(bufferSlots, 'WRIST')
  const primeval = variantOf(ETHEREAL_SET, 'WRIST', '태초', '일반')
  const consecrated = variantOf(SOUL_FAIRY_SET, 'JACKET', '에픽', '축성')
  const unique = variantOf(SOUL_FAIRY_SET, 'JACKET', '유니크', '일반')
  const changed = apply(
    NO_CHANGES,
    { type: 'change', slot: wrist, draft: { variantId: primeval.id } },
    { type: 'change', slot: dealerJacket, draft: { variantId: unique.id } }
  )

  expect(hasChanges(changed)).toBe(true)
  expect(
    apply(
      changed,
      { type: 'change', slot: wrist, draft: { variantId: null } },
      { type: 'change', slot: dealerJacket, draft: { variantId: consecrated.id } }
    )
  ).toEqual(NO_CHANGES)
})

it('닫힌 선택 칸의 아이템은 방어구 5부위가 모두 축성이면 공용 이름 아이템이고, 하나를 바꾸면 축성 아이템과 세트 이름 아이템이다', () => {
  const corroded = variantOf(SOUL_FAIRY_SET, 'JACKET', '에픽', '잠식')
  const worn = resolvedItemsOf(dealerRows, NO_CHANGES)
  const broken = resolvedItemsOf(
    dealerRows,
    apply(NO_CHANGES, { type: 'change', slot: dealerJacket, draft: { variantId: corroded.id } })
  )

  expect([worn.JACKET?.itemName, worn.AMULET?.itemName, worn.SUPPORT?.itemName]).toEqual([
    '긍휼 속 자비의 상의',
    '성스러운 믿음의 목걸이',
    '초연한 청렴의 보조장비'
  ])
  expect(broken.JACKET).toEqual({
    itemId: corroded.item.itemId,
    itemName: corroded.item.itemName,
    rarity: 'epic'
  })
  expect(broken.SHOULDER?.itemName).toBe(
    variantOf(SOUL_FAIRY_SET, 'SHOULDER', '에픽', '축성').item.itemName
  )
  expect(broken.AMULET?.itemName).toBe(
    variantOf(SOUL_FAIRY_SET, 'AMULET', '태초', '일반').item.itemName
  )
  expect(broken.SHOULDER?.itemName).toMatch(/^축성 : /)
})

it('선택지에 없는 착용 아이템을 그대로 둔 부위는 닫힌 선택 칸의 아이템을 따로 구하지 않는다', () => {
  expect(resolvedItemsOf(bufferRows, NO_CHANGES).WRIST).toBeUndefined()
})

const dealerSet = toEquipmentSet(characterDetailFixture('dealer'))!

function switchSet(changes: SimulatorChanges, rows: readonly SimulatorRow[], setItemId: string) {
  return apply(changes, { type: 'equipmentSet', rows, equipmentSet: dealerSet, setItemId })
}

it('장비 세트 줄은 선택 목록에 있는 세트 가운데 세트 포인트가 가장 큰 세트를 주 세트로 둔다', () => {
  expect(dealerSet.mainSetId).toBe(SOUL_FAIRY_SET)
  expect(dealerSet.sets).toHaveLength(13)
  expect(toEquipmentSet(withSets(bufferDetail, [pointed('unlisted-set', 9_999)]))).toBeNull()
})

it('장비 세트를 고르면 11부위의 선택지와 기준 아이템이 그 세트의 같은 등급, 같은 종류가 되고 세트만 요청한다', () => {
  const changed = switchSet(NO_CHANGES, dealerRows, SHADOW_SET)
  const rows = rowsInEquipmentSet(dealerRows, changed.equipmentSet)
  const slots = slotsOf(rows)
  const jacket = slotOf(slots, 'JACKET')
  const earring = slotOf(slots, 'EARRING')

  expect(changed.equipmentSet).toBe(SHADOW_SET)
  expect(slotOf(slots, 'WEAPON')).toEqual(weapon)
  expect(idsOf(jacket.variants)).toEqual(idsOf(equipmentVariantsOf(SHADOW_SET, 'JACKET')))
  expect(jacket.wornVariantId).toBe(variantOf(SHADOW_SET, 'JACKET', '에픽', '축성').id)
  expect(earring.wornVariantId).toBe(variantOf(SHADOW_SET, 'EARRING', '에픽', '일반').id)
  expect(resolvedItemsOf(rows, changed).JACKET?.itemId).toBe(
    variantOf(SHADOW_SET, 'JACKET', '에픽', '축성').consecrated?.itemId
  )
  expect(simulationBody(rows, null, changed)).toEqual({ equipmentSet: SHADOW_SET, equipment: [] })
  expect(switchSet(changed, dealerRows, SOUL_FAIRY_SET)).toEqual(NO_CHANGES)
})

it('장비 세트를 고른 뒤 바꾼 부위의 등급은 새 세트의 선택지 id로 요청한다', () => {
  const corroded = variantOf(SHADOW_SET, 'JACKET', '에픽', '잠식')
  const switched = switchSet(NO_CHANGES, dealerRows, SHADOW_SET)
  const rows = rowsInEquipmentSet(dealerRows, switched.equipmentSet)
  const jacket = slotOf(slotsOf(rows), 'JACKET')
  const changed = apply(switched, {
    type: 'change',
    slot: jacket,
    draft: { variantId: corroded.id }
  })

  expect(simulationBody(rows, null, changed)).toEqual({
    equipmentSet: SHADOW_SET,
    equipment: [
      {
        slotId: 'JACKET',
        reinforce: 0,
        amplified: false,
        enchantId: null,
        variantId: corroded.id,
        tune: 0,
        potency: null,
        release: null
      }
    ]
  })
})

it('장비 세트를 바꾸면 부위에서 고른 등급을 새 세트의 같은 등급으로 옮기고 마법부여와 조율은 유지한다', () => {
  const enchantId = firstOptionId('EARRING', 'dealer')
  const legendary = variantOf(SOUL_FAIRY_SET, 'EARRING', '레전더리', '일반')
  const before = apply(
    NO_CHANGES,
    { type: 'change', slot: dealerEarring, draft: { enchantId } },
    { type: 'change', slot: dealerEarring, draft: { tune: 2 } },
    { type: 'change', slot: dealerEarring, draft: { variantId: legendary.id } }
  )
  const changed = switchSet(before, dealerRows, SHADOW_SET)
  const rows = rowsInEquipmentSet(dealerRows, changed.equipmentSet)

  const movedLegendary = variantOf(SHADOW_SET, 'EARRING', '레전더리', '일반').id

  expect(changed.equipment.EARRING).toEqual({
    reinforce: 8,
    amplified: true,
    enchantId,
    variantId: movedLegendary,
    tune: 2,
    potency: null,
    release: null
  })
  expect(simulationBody(rows, null, changed).equipment).toEqual([
    {
      slotId: 'EARRING',
      reinforce: 8,
      amplified: true,
      enchantId,
      variantId: movedLegendary,
      tune: 2,
      potency: null,
      release: null
    }
  ])
})

it('장비 세트를 바꿔도 부위에서 고른 유일 장비와 정밀도는 그대로 둔다', () => {
  const exalted = variantOf(SOUL_FAIRY_SET, 'EARRING', '태초', '유일')
  const before = apply(
    NO_CHANGES,
    { type: 'change', slot: dealerEarring, draft: { variantId: exalted.id } },
    { type: 'change', slot: dealerEarring, draft: { potency: 60 } }
  )
  const changed = switchSet(before, dealerRows, SHADOW_SET)

  expect(changed.equipment.EARRING).toMatchObject({ variantId: exalted.id, tune: 0, potency: 60 })
})

it('세트가 섞인 캐릭터는 주 세트를 골라도 다른 세트의 부위가 그 세트로 옮겨 가 세트를 요청하고, 바뀌는 부위가 없으면 고르지 않은 것으로 둔다', () => {
  const shadowJacket = variantOf(SHADOW_SET, 'JACKET', '에픽', '일반')
  const mixed = withItem(characterDetailFixture('dealer'), 'JACKET', {
    itemId: shadowJacket.item.itemId,
    itemName: shadowJacket.item.itemName,
    setItemId: SHADOW_SET
  })
  const rows = toSimulatorRows(mixed)
  const mixedSet = toEquipmentSet(mixed)!
  const changed = apply(NO_CHANGES, {
    type: 'equipmentSet',
    rows,
    equipmentSet: mixedSet,
    setItemId: SOUL_FAIRY_SET
  })
  const jacket = slotOf(slotsOf(rowsInEquipmentSet(rows, changed.equipmentSet)), 'JACKET')

  expect(mixedSet.mainSetId).toBe(SOUL_FAIRY_SET)
  expect(changed.equipmentSet).toBe(SOUL_FAIRY_SET)
  expect(jacket.wornVariantId).toBe(variantOf(SOUL_FAIRY_SET, 'JACKET', '에픽', '일반').id)
  expect(simulationBody(rows, null, changed)).toEqual({
    equipmentSet: SOUL_FAIRY_SET,
    equipment: []
  })
  expect(switchSet(NO_CHANGES, dealerRows, SOUL_FAIRY_SET)).toEqual(NO_CHANGES)
})

it('장비 세트를 바꿔도 선택지에 없는 착용 아이템은 그대로 두고 새 세트의 선택지를 둔다', () => {
  const bufferSetChanges = apply(NO_CHANGES, {
    type: 'equipmentSet',
    rows: bufferRows,
    equipmentSet: toEquipmentSet(bufferDetail)!,
    setItemId: SHADOW_SET
  })
  const wrist = slotOf(
    slotsOf(rowsInEquipmentSet(bufferRows, bufferSetChanges.equipmentSet)),
    'WRIST'
  )

  expect(wrist.wornVariantId).toBeNull()
  expect(idsOf(wrist.variants)).toEqual(idsOf(equipmentVariantsOf(SHADOW_SET, 'WRIST')))
})

it('선택지에 없는 착용 무기는 그 무기의 최대 단계까지 조율을 받아 tune만 요청하고, 조율할 수 없는 무기는 받지 않는다', () => {
  const rows = toSimulatorRows(
    withItem(characterDetailFixture('dealer'), 'WEAPON', {
      itemId: 'unlisted-weapon',
      itemName: 'Beast-Saw'
    })
  )
  const tunable = slotOf(slotsOf(rows), 'WEAPON')
  const changed = apply(NO_CHANGES, { type: 'change', slot: tunable, draft: { tune: 2 } })

  expect(tuneLimitOf(tunable, null)).toBe(3)
  expect(tuneLimitOf(weapon, null)).toBe(0)
  expect(simulationBody(rows, null, changed).equipment).toEqual([
    {
      slotId: 'WEAPON',
      reinforce: 10,
      amplified: false,
      enchantId: null,
      variantId: null,
      tune: 2,
      potency: null,
      release: null
    }
  ])
  expect(apply(NO_CHANGES, { type: 'change', slot: tunable, draft: { tune: 4 } })).toEqual(
    NO_CHANGES
  )
})

const SCYTHE = {
  legacyPrimeval: '413aebce4d4cc7c7346aa6e32e27a6dd',
  releasePending: '6aeca595f1b6f1c33e28f8d51c3f5b89'
}
// 버퍼 fixture는 선현궁 에픽 기본 계열 무기(시크릿 듀엣)를 낀다.
const HARP_RELEASE = 'da48e7a57b27009cc0cc7765722edca2'

function weaponChange(fields: Partial<SimulationChange>): SimulationChange {
  return {
    slotId: 'WEAPON',
    reinforce: 10,
    amplified: false,
    enchantId: null,
    ...KEPT_ITEM,
    ...fields
  }
}

it('무기는 착용한 무기 종류의 선택지를 목록 순서대로 계열 이름과 등급으로 두고 착용 무기를 고른 상태다', () => {
  expect(weapon.variants.map(({ name, rarity }) => [name, rarity])).toEqual([
    ['유니크', 'unique'],
    ['레거시', 'legendary'],
    ['태초의 별', 'legendary'],
    ['레거시', 'epic'],
    ['태초의 별', 'epic'],
    ['레거시', 'primordial'],
    [TUNED_WEAPON_NAME, 'primordial'],
    ['디거시', 'primordial'],
    ['태초의 별', 'primordial']
  ])
  expect(weapon.wornVariantId).toBe(SCYTHE_RELEASE)
  expect(weapon.wornRelease).toBe(100)
  expect(resolvedItemsOf(dealerRows, NO_CHANGES).WEAPON?.itemName).toBe('디거시')
})

it('디거시에서 레거시로 바꾸면 해방 수치를 비우고 조율을 열며, 디거시로 돌아오면 착용한 수치로 되돌린다', () => {
  const legacy = apply(NO_CHANGES, {
    type: 'change',
    slot: weapon,
    draft: { variantId: SCYTHE.legacyPrimeval }
  })

  expect(draftOf(weapon, legacy)).toMatchObject({ tune: 0, release: null })
  expect(tuneLimitOf(weapon, SCYTHE.legacyPrimeval)).toBe(3)
  expect(simulationBody(dealerRows, null, legacy).equipment).toEqual([
    weaponChange({ variantId: SCYTHE.legacyPrimeval, tune: 0 })
  ])
  expect(
    apply(legacy, { type: 'change', slot: weapon, draft: { variantId: SCYTHE_RELEASE } })
  ).toEqual(NO_CHANGES)
})

it('해방 수치는 해방 계열에서만 0부터 100까지 정수로 받고, 100 미만이면 "억압 - " 아이템이 된다', () => {
  const lowered = apply(NO_CHANGES, { type: 'change', slot: weapon, draft: { release: 81 } })
  const legacy = apply(NO_CHANGES, {
    type: 'change',
    slot: weapon,
    draft: { variantId: SCYTHE.legacyPrimeval }
  })

  expect(simulationBody(dealerRows, null, lowered).equipment).toEqual([
    weaponChange({ release: 81 })
  ])
  expect(resolvedItemsOf(dealerRows, lowered).WEAPON).toEqual({
    itemId: SCYTHE.releasePending,
    itemName: '디거시',
    rarity: 'primordial'
  })
  for (const release of [101, -1, 50.5]) {
    expect(apply(NO_CHANGES, { type: 'change', slot: weapon, draft: { release } })).toEqual(
      NO_CHANGES
    )
  }
  expect(apply(legacy, { type: 'change', slot: weapon, draft: { release: 50 } })).toEqual(legacy)
})

it('해방 계열이 아닌 무기를 디거시로 바꾸면 해방 수치 100에서 시작하고 함께 요청한다', () => {
  const bufferWeapon = slotOf(bufferSlots, 'WEAPON')
  const changed = apply(NO_CHANGES, {
    type: 'change',
    slot: bufferWeapon,
    draft: { variantId: HARP_RELEASE }
  })

  expect(bufferWeapon.wornRelease).toBeNull()
  expect(simulationBody(bufferRows, null, changed).equipment).toEqual([
    weaponChange({ reinforce: 0, variantId: HARP_RELEASE, release: 100 })
  ])
})

it('"억압 - " 아이템을 낀 무기는 디거시를 고른 상태로 착용한 해방 수치에서 시작하고, 100으로 올리면 해방 아이템이 된다', () => {
  const rows = toSimulatorRows(
    withItem(characterDetailFixture('dealer'), 'WEAPON', {
      itemId: SCYTHE.releasePending,
      itemName: '억압 - 재앙의 송곳니',
      weaponRelease: { value: 81 }
    })
  )
  const pending = slotOf(slotsOf(rows), 'WEAPON')
  const full = apply(NO_CHANGES, { type: 'change', slot: pending, draft: { release: 100 } })

  expect(draftOf(pending, NO_CHANGES)).toMatchObject({ variantId: SCYTHE_RELEASE, release: 81 })
  expect(resolvedItemsOf(rows, full).WEAPON?.itemId).toBe(SCYTHE_RELEASE)
  expect(simulationBody(rows, null, full).equipment).toEqual([weaponChange({ release: 100 })])
})

it('초기화하면 고른 장비 세트도 지운다', () => {
  const changed = switchSet(NO_CHANGES, dealerRows, SHADOW_SET)

  expect(hasChanges(changed)).toBe(true)
  expect(apply(changed, { type: 'reset' })).toEqual(NO_CHANGES)
})

it('장비 세트를 골라도 선택지 밖 착용 아이템을 낀 부위는 조율까지 그대로 두고 요청에 넣지 않는다', () => {
  const detail = withItem(bufferDetail, 'WRIST', { tune: [{ level: 2, setPoint: 235 }] })
  const rows = toSimulatorRows(detail)
  const changed = apply(NO_CHANGES, {
    type: 'equipmentSet',
    rows,
    equipmentSet: toEquipmentSet(detail)!,
    setItemId: SHADOW_SET
  })
  const viewRows = rowsInEquipmentSet(rows, changed.equipmentSet)
  const wrist = slotOf(slotsOf(viewRows), 'WRIST')

  expect(changed.equipment.WRIST).toBeUndefined()
  expect(draftOf(wrist, changed)).toMatchObject({ variantId: null, tune: 2 })
  expect(simulationBody(viewRows, null, changed)).toEqual({
    equipmentSet: SHADOW_SET,
    equipment: []
  })
})

const dealerSwitching = toSimulatorSwitching(characterDetailFixture('dealer'), 'dealer')!

it('스위칭 레벨은 고른 레벨만 요청에 싣고, 지금 레벨로 돌아오거나 고를 수 없는 레벨이면 바꾼 것이 없다', () => {
  const changed = apply(NO_CHANGES, { type: 'buffLevel', switching: dealerSwitching, level: 20 })

  expect(simulationBody([], null, changed)).toEqual({ equipment: [], buffLevel: 20 })
  expect(hasChanges(changed)).toBe(true)
  expect(apply(changed, { type: 'buffLevel', switching: dealerSwitching, level: 16 })).toEqual(
    NO_CHANGES
  )
  expect(apply(NO_CHANGES, { type: 'buffLevel', switching: dealerSwitching, level: 21 })).toEqual(
    NO_CHANGES
  )
  expect(apply(changed, { type: 'buffLevel', switching: dealerSwitching, level: 9 })).toEqual(
    changed
  )
})

it('아바타는 종결 아바타와 엠블렘을 고르면 프리셋을 요청에 싣고, 현재 착용 아바타로 돌아오면 바꾼 것이 없다', () => {
  const changed = apply(NO_CHANGES, { type: 'avatarPreset', preset: 'best' })

  expect(simulationBody([], null, changed)).toEqual({ equipment: [], avatarPreset: 'best' })
  expect(hasChanges(changed)).toBe(true)
  expect(apply(changed, { type: 'avatarPreset', preset: null })).toEqual(NO_CHANGES)
})
