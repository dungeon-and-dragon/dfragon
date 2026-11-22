import {
  ENCHANT_GRADE_SLOTS,
  type EnchantGradeSlot,
  type EnchantGradeTier,
  enchantGradesOf
} from '@dfragon/lib/enchant-grades'
import {
  type CharacterDetailView,
  type EnchantOption,
  type EnchantRole,
  type ItemView,
  toItemView
} from '#entities/character'
import { enchantLabels } from './enchant-label'

type EquipmentItem = CharacterDetailView['equipment']['equipment'][number]

// API가 현재 수치보다 높게 올리는 변경을 거절하는 상한이다. 이미 더 높은 장비는 그 수치까지 둔다.
const REINFORCE_LIMIT = 20
// 점수 엔진이 강화, 증폭 수치를 다시 계산하는 장비 레벨이다.
const SIMULATED_ITEM_LEVEL = 115

export type EnchantChoice = Readonly<{
  id: string
  tier: EnchantGradeTier
  options: EnchantOption[]
}>

export type SimulatorSlot = ItemView &
  Readonly<{
    slotId: EnchantGradeSlot
    slotName: string | null
    reinforce: number
    amplified: boolean
    reinforceLimit: number
    reinforceEditable: boolean
    enchants: EnchantOption[]
    enchantChoices: EnchantChoice[]
  }>

/** `enchantId`가 null이면 착용한 마법부여를 그대로 둔다. */
export type SlotDraft = Readonly<{
  reinforce: number
  amplified: boolean
  enchantId: string | null
}>

/** 원본과 다른 부위만 담는다. */
export type SimulatorChanges = Readonly<Partial<Record<EnchantGradeSlot, SlotDraft>>>

export type SimulationChange = SlotDraft & Readonly<{ slotId: EnchantGradeSlot }>

export type SimulationBody = Readonly<{ equipment: SimulationChange[] }>

export type SimulatorAction =
  | Readonly<{ type: 'change'; slot: SimulatorSlot; draft: Partial<SlotDraft> }>
  | Readonly<{ type: 'reset' }>

function isGradeSlot(slotId: string | null): slotId is EnchantGradeSlot {
  return ENCHANT_GRADE_SLOTS.some((gradeSlot) => gradeSlot === slotId)
}

export function simulatorRole(card: CharacterDetailView['card']): EnchantRole {
  if (card?.role === 'buffer') {
    return 'buffer'
  }

  return 'dealer'
}

function enchantChoices(slotId: EnchantGradeSlot, role: EnchantRole): EnchantChoice[] {
  const tiers = enchantGradesOf(slotId, role)
  const tierNames: EnchantGradeTier[] = ['종결', '준종결']

  return tierNames.flatMap((tier) =>
    tiers[tier].map((grade) => {
      const options = enchantLabels(grade, role)

      return { id: grade.id, tier, options }
    })
  )
}

function toSimulatorSlot(
  item: EquipmentItem & { slotId: EnchantGradeSlot },
  role: EnchantRole
): SimulatorSlot {
  const reinforce = item.reinforce ?? 0
  const itemView = toItemView(item)
  const amplified = item.amplificationName != null
  const reinforceLimit = Math.max(REINFORCE_LIMIT, reinforce)
  const reinforceEditable = item.itemAvailableLevel === SIMULATED_ITEM_LEVEL
  const enchants = enchantLabels(item.enchant, role)
  const choices = enchantChoices(item.slotId, role)

  return {
    ...itemView,
    slotId: item.slotId,
    slotName: item.slotName,
    reinforce,
    amplified,
    reinforceLimit,
    reinforceEditable,
    enchants,
    enchantChoices: choices
  }
}

export function toSimulatorSlots(
  detail: Pick<CharacterDetailView, 'equipment' | 'card'>
): SimulatorSlot[] {
  const role = simulatorRole(detail.card)

  return detail.equipment.equipment.flatMap((item) => {
    const { slotId } = item

    if (!isGradeSlot(slotId)) {
      return []
    }

    return [toSimulatorSlot({ ...item, slotId }, role)]
  })
}

function originalDraft(slot: SimulatorSlot): SlotDraft {
  return { reinforce: slot.reinforce, amplified: slot.amplified, enchantId: null }
}

export function draftOf(slot: SimulatorSlot, changes: SimulatorChanges): SlotDraft {
  const changed = changes[slot.slotId]

  if (changed === undefined) {
    return originalDraft(slot)
  }

  return changed
}

function isOriginal(slot: SimulatorSlot, draft: SlotDraft): boolean {
  return (
    draft.reinforce === slot.reinforce &&
    draft.amplified === slot.amplified &&
    draft.enchantId === null
  )
}

function isReinforceInRange(slot: SimulatorSlot, reinforce: number): boolean {
  return Number.isInteger(reinforce) && reinforce >= 0 && reinforce <= slot.reinforceLimit
}

function isAllowed(slot: SimulatorSlot, draft: Partial<SlotDraft>): boolean {
  const changesReinforce = draft.reinforce !== undefined || draft.amplified !== undefined

  if (changesReinforce && !slot.reinforceEditable) {
    return false
  }

  if (draft.reinforce !== undefined && !isReinforceInRange(slot, draft.reinforce)) {
    return false
  }

  return draft.enchantId == null || slot.enchantChoices.some(({ id }) => id === draft.enchantId)
}

function changeSlot(
  changes: SimulatorChanges,
  slot: SimulatorSlot,
  draft: Partial<SlotDraft>
): SimulatorChanges {
  if (!isAllowed(slot, draft)) {
    return changes
  }

  const current = draftOf(slot, changes)
  const next = { ...current, ...draft }
  const { [slot.slotId]: _previous, ...others } = changes

  if (isOriginal(slot, next)) {
    return others
  }

  return { ...others, [slot.slotId]: next }
}

export function simulatorReducer(
  changes: SimulatorChanges,
  action: SimulatorAction
): SimulatorChanges {
  switch (action.type) {
    case 'change':
      return changeSlot(changes, action.slot, action.draft)
    case 'reset':
      return {}
  }
}

/** 바꾼 부위만 화면의 부위 순서대로 넣어, 같은 변경은 늘 같은 요청이 된다. */
export function simulationBody(
  slots: readonly SimulatorSlot[],
  changes: SimulatorChanges
): SimulationBody {
  const equipment = slots.flatMap((slot) => {
    const draft = changes[slot.slotId]

    if (draft === undefined) {
      return []
    }

    return [{ slotId: slot.slotId, ...draft }]
  })

  return { equipment }
}

export function hasChanges(changes: SimulatorChanges): boolean {
  return Object.keys(changes).length > 0
}
