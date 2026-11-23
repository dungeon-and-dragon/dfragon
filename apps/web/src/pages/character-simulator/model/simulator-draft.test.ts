import { type EnchantGradeSlot, enchantOptionsOf } from '@dfragon/lib/enchant-grades'
import { slotItemsOf } from '@dfragon/lib/slot-items'
import { expect, it } from 'vitest'
import type { CharacterDetailView } from '#entities/character'
import { characterDetailFixture } from '#entities/character/api/character-detail.fixture'
import {
  draftOf,
  hasChanges,
  NO_CHANGES,
  type SimulatorAction,
  type SimulatorChanges,
  type SimulatorRow,
  type SimulatorSlot,
  type SimulatorSlotItem,
  simulationBody,
  simulatorReducer,
  slotItemChoiceOf,
  toSimulatorRows
} from './simulator-draft'

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
  expect(draftOf(weapon, NO_CHANGES)).toEqual({ reinforce: 10, amplified: false, enchantId: null })
  expect(draftOf(slotOf(dealerSlots, 'EARRING'), NO_CHANGES)).toEqual({
    reinforce: 8,
    amplified: true,
    enchantId: null
  })
  expect(simulationBody(dealerRows, NO_CHANGES)).toEqual({ equipment: [] })
})

it('버퍼의 0 증폭 장비는 증폭으로 두고, 마법부여 목록은 버퍼 등급표에서만 고른다', () => {
  const bufferSlots = slotsOf(toSimulatorRows(characterDetailFixture('buffer')))
  const jacket = slotOf(bufferSlots, 'JACKET')
  const bufferIds = Object.values(enchantOptionsOf('JACKET', 'buffer'))
    .flat()
    .map(({ id }) => id)

  expect(draftOf(jacket, NO_CHANGES)).toEqual({ reinforce: 0, amplified: true, enchantId: null })
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

  expect(simulationBody(dealerRows, changed)).toEqual({
    equipment: [
      { slotId: 'WEAPON', reinforce: 12, amplified: true, enchantId: null },
      { slotId: 'AMULET', reinforce: 0, amplified: false, enchantId }
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
  ).toEqual({ reinforce: 20, amplified: false, enchantId: null })
  expect(
    draftOf(weapon, apply(NO_CHANGES, { type: 'change', slot: weapon, draft: { reinforce: 0 } }))
  ).toEqual({ reinforce: 0, amplified: false, enchantId: null })
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
  ).toEqual({ reinforce: 22, amplified: false, enchantId: null })
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
  expect(simulationBody([{ kind: 'equipment', slot: oldAmulet }], changed)).toEqual({
    equipment: [{ slotId: 'AMULET', reinforce: 0, amplified: false, enchantId }]
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
  expect(simulationBody(dealerRows, chosen)).toEqual({
    equipment: [],
    title: titleItem!.id,
    aura: auraItem!.id
  })

  const withWeapon = apply(chosen, { type: 'change', slot: weapon, draft: { reinforce: 11 } })

  expect(simulationBody(dealerRows, withWeapon)).toEqual({
    equipment: [{ slotId: 'WEAPON', reinforce: 11, amplified: false, enchantId: null }],
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
