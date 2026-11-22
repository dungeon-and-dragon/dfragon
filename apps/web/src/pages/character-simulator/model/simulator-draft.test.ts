import { type EnchantGradeSlot, enchantOptionsOf } from '@dfragon/lib/enchant-grades'
import { expect, it } from 'vitest'
import type { CharacterDetailView } from '#entities/character'
import { characterDetailFixture } from '#entities/character/api/character-detail.fixture'
import {
  draftOf,
  type SimulatorAction,
  type SimulatorChanges,
  type SimulatorSlot,
  simulationBody,
  simulatorReducer,
  toSimulatorSlots
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

const dealerSlots = toSimulatorSlots(characterDetailFixture('dealer'))
const weapon = slotOf(dealerSlots, 'WEAPON')
const amulet = slotOf(dealerSlots, 'AMULET')

it('장비 12부위만 응답 순서대로 두고 칭호는 빼며, 착용한 수치와 강화, 증폭을 기본값으로 둔다', () => {
  expect(dealerSlots.map(({ slotId }) => slotId)).toEqual(GRADE_SLOTS)
  expect(draftOf(weapon, {})).toEqual({ reinforce: 10, amplified: false, enchantId: null })
  expect(draftOf(slotOf(dealerSlots, 'EARRING'), {})).toEqual({
    reinforce: 8,
    amplified: true,
    enchantId: null
  })
  expect(simulationBody(dealerSlots, {})).toEqual({ equipment: [] })
})

it('버퍼의 0 증폭 장비는 증폭으로 두고, 마법부여 목록은 버퍼 등급표에서만 고른다', () => {
  const bufferSlots = toSimulatorSlots(characterDetailFixture('buffer'))
  const jacket = slotOf(bufferSlots, 'JACKET')
  const bufferIds = Object.values(enchantOptionsOf('JACKET', 'buffer'))
    .flat()
    .map(({ id }) => id)

  expect(draftOf(jacket, {})).toEqual({ reinforce: 0, amplified: true, enchantId: null })
  expect(jacket.enchantChoices.map(({ id }) => id)).toEqual(bufferIds)
  expect(jacket.enchantChoices.length).toBeGreaterThan(0)
})

it('바꾼 부위만 그 부위의 원하는 상태 전체로 요청 body에 넣고, 원래 값으로 되돌리면 뺀다', () => {
  const enchantId = firstOptionId('AMULET', 'dealer')
  const changed = apply(
    {},
    { type: 'change', slot: amulet, draft: { enchantId } },
    { type: 'change', slot: weapon, draft: { reinforce: 12 } },
    { type: 'change', slot: weapon, draft: { amplified: true } }
  )

  expect(simulationBody(dealerSlots, changed)).toEqual({
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

  expect(restored).toEqual({})
})

it('초기화하면 바꾼 부위가 모두 원래대로 돌아간다', () => {
  const changed = apply({}, { type: 'change', slot: weapon, draft: { reinforce: 15 } })

  expect(apply(changed, { type: 'reset' })).toEqual({})
})

it('수치는 +0부터 +20까지 받고, 20을 넘는 장비는 지금 수치까지 받는다', () => {
  const overLimit = slotOf(
    toSimulatorSlots(withItem(characterDetailFixture('dealer'), 'WEAPON', { reinforce: 23 })),
    'WEAPON'
  )

  expect(weapon.reinforceLimit).toBe(20)
  expect(overLimit.reinforceLimit).toBe(23)
  expect(
    draftOf(weapon, apply({}, { type: 'change', slot: weapon, draft: { reinforce: 20 } }))
  ).toEqual({ reinforce: 20, amplified: false, enchantId: null })
  expect(
    draftOf(weapon, apply({}, { type: 'change', slot: weapon, draft: { reinforce: 0 } }))
  ).toEqual({ reinforce: 0, amplified: false, enchantId: null })
  expect(apply({}, { type: 'change', slot: weapon, draft: { reinforce: 21 } })).toEqual({})
  expect(apply({}, { type: 'change', slot: overLimit, draft: { reinforce: 24 } })).toEqual({})
  expect(apply({}, { type: 'change', slot: weapon, draft: { reinforce: -1 } })).toEqual({})
  expect(
    draftOf(overLimit, apply({}, { type: 'change', slot: overLimit, draft: { reinforce: 22 } }))
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
    draftOf(weapon, apply({}, { type: 'change', slot: weapon, draft: { enchantId: merged!.id } }))
      .enchantId
  ).toBe(merged!.id)
  expect(apply({}, { type: 'change', slot: weapon, draft: { enchantId: other!.id } })).toEqual({})
})

it('등급표에 없는 마법부여는 받지 않는다', () => {
  const otherSlotId = firstOptionId('WEAPON', 'dealer')

  expect(apply({}, { type: 'change', slot: amulet, draft: { enchantId: otherSlotId } })).toEqual({})
})

it('115레벨이 아닌 장비는 수치와 강화, 증폭을 바꾸지 않고 마법부여만 바꾼다', () => {
  const detail = withItem(characterDetailFixture('dealer'), 'AMULET', { itemAvailableLevel: 110 })
  const oldAmulet = slotOf(toSimulatorSlots(detail), 'AMULET')
  const enchantId = firstOptionId('AMULET', 'dealer')
  const changed = apply(
    {},
    { type: 'change', slot: oldAmulet, draft: { reinforce: 12 } },
    { type: 'change', slot: oldAmulet, draft: { amplified: true } },
    { type: 'change', slot: oldAmulet, draft: { enchantId } }
  )

  expect(oldAmulet.reinforceEditable).toBe(false)
  expect(weapon.reinforceEditable).toBe(true)
  expect(simulationBody([oldAmulet], changed)).toEqual({
    equipment: [{ slotId: 'AMULET', reinforce: 0, amplified: false, enchantId }]
  })
})
