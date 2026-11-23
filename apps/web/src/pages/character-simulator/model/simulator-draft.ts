import {
  ENCHANT_GRADE_SLOTS,
  type EnchantGradeSlot,
  type EnchantGradeTier,
  enchantOptionsOf
} from '@dfragon/lib/enchant-grades'
import { type SlotItemCategory, slotItemsOf } from '@dfragon/lib/slot-items'
import {
  type CharacterDetailView,
  type EnchantOption,
  type EnchantRole,
  type ItemView,
  toItemView
} from '#entities/character'
import { equippedEnchantLabels, optionEnchantLabels } from './enchant-label'

type EquipmentItem = CharacterDetailView['equipment']['equipment'][number]
type SimulatorDetail = Pick<CharacterDetailView, 'equipment' | 'card' | 'creature' | 'avatar'>
type WornItem = Parameters<typeof toItemView>[0]

const TITLE_SLOT_ID = 'TITLE'
const AURA_SLOT_ID = 'AURORA'
// 캐릭터 상세 장비 탭과 같은 부위 이름이다. 칭호는 응답의 부위 이름을 쓴다.
const SLOT_ITEM_NAMES: Readonly<Record<SlotItemCategory, string>> = {
  title: '칭호',
  creature: '크리쳐',
  aura: '오라'
}

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

export type SlotItemChoice = Readonly<{
  id: string
  name: string
  itemId: string | null
  rarity: ItemView['rarity']
}>

export type SimulatorSlotItem = ItemView &
  Readonly<{
    category: SlotItemCategory
    slotName: string
    choices: readonly SlotItemChoice[]
  }>

export type SimulatorRow =
  | Readonly<{ kind: 'equipment'; slot: SimulatorSlot }>
  | Readonly<{ kind: 'slotItem'; slotItem: SimulatorSlotItem }>

/** `enchantId`가 null이면 착용한 마법부여를 그대로 둔다. */
export type SlotDraft = Readonly<{
  reinforce: number
  amplified: boolean
  enchantId: string | null
}>

/** 원본과 다른 장비 부위와 바꾸려고 고른 칭호, 크리쳐, 오라 묶음 id만 담는다. */
export type SimulatorChanges = Readonly<{
  equipment: Readonly<Partial<Record<EnchantGradeSlot, SlotDraft>>>
  slotItems: Readonly<Partial<Record<SlotItemCategory, string>>>
}>

export const NO_CHANGES: SimulatorChanges = { equipment: {}, slotItems: {} }

export type SimulationChange = SlotDraft & Readonly<{ slotId: EnchantGradeSlot }>

export type SimulationBody = Readonly<
  { equipment: SimulationChange[] } & Partial<Record<SlotItemCategory, string>>
>

export type SimulatorAction =
  | Readonly<{ type: 'change'; slot: SimulatorSlot; draft: Partial<SlotDraft> }>
  | Readonly<{ type: 'slotItem'; slotItem: SimulatorSlotItem; id: string | null }>
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
  const tiers = enchantOptionsOf(slotId, role)
  const tierNames: EnchantGradeTier[] = ['종결', '준종결']

  return tierNames.flatMap((tier) =>
    tiers[tier].map((option) => {
      const options = optionEnchantLabels(option, role)

      return { id: option.id, tier, options }
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
  const enchants = equippedEnchantLabels(item.enchant, role)
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

function slotItemRow(
  category: SlotItemCategory,
  item: WornItem | null | undefined,
  slotName: string | null = null
): SimulatorRow[] {
  // API는 착용하지 않은 부위의 교체를 거절하므로, 캐릭터 상세 장비 탭처럼 그 행을 두지 않는다.
  if (item?.itemId == null) {
    return []
  }

  const choices = slotItemsOf(category).map(({ id, name, item: represented }) => {
    const { itemId, rarity } = toItemView(represented)

    return { id, name, itemId, rarity }
  })
  const view = toItemView(item)
  const name = slotName ?? SLOT_ITEM_NAMES[category]
  const slotItem = { ...view, category, slotName: name, choices }

  return [{ kind: 'slotItem', slotItem }]
}

/** 칭호는 응답의 부위 순서 자리에, 크리쳐와 오라는 캐릭터 상세 장비 탭처럼 장비 뒤에 둔다. 장비는 등급표의 12부위만 둔다. */
export function toSimulatorRows(detail: SimulatorDetail): SimulatorRow[] {
  const role = simulatorRole(detail.card)
  const equipment = detail.equipment.equipment.flatMap((item): SimulatorRow[] => {
    const { slotId } = item

    if (slotId === TITLE_SLOT_ID) {
      return slotItemRow('title', item, item.slotName)
    }

    if (!isGradeSlot(slotId)) {
      return []
    }

    const slot = toSimulatorSlot({ ...item, slotId }, role)

    return [{ kind: 'equipment', slot }]
  })

  const aura = detail.avatar.find(({ slotId }) => slotId === AURA_SLOT_ID)

  return [...equipment, ...slotItemRow('creature', detail.creature), ...slotItemRow('aura', aura)]
}

function originalDraft(slot: SimulatorSlot): SlotDraft {
  return { reinforce: slot.reinforce, amplified: slot.amplified, enchantId: null }
}

export function draftOf(slot: SimulatorSlot, changes: SimulatorChanges): SlotDraft {
  const changed = changes.equipment[slot.slotId]

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
  const { [slot.slotId]: _previous, ...others } = changes.equipment

  if (isOriginal(slot, next)) {
    return { ...changes, equipment: others }
  }

  return { ...changes, equipment: { ...others, [slot.slotId]: next } }
}

export function slotItemChoiceOf(
  slotItem: SimulatorSlotItem,
  changes: SimulatorChanges
): string | null {
  const chosen = changes.slotItems[slotItem.category]

  if (chosen === undefined) {
    return null
  }

  return chosen
}

function changeSlotItem(
  changes: SimulatorChanges,
  slotItem: SimulatorSlotItem,
  id: string | null
): SimulatorChanges {
  const { [slotItem.category]: _previous, ...others } = changes.slotItems

  if (id === null) {
    return { ...changes, slotItems: others }
  }

  if (!slotItem.choices.some((choice) => choice.id === id)) {
    return changes
  }

  return { ...changes, slotItems: { ...others, [slotItem.category]: id } }
}

export function simulatorReducer(
  changes: SimulatorChanges,
  action: SimulatorAction
): SimulatorChanges {
  switch (action.type) {
    case 'change':
      return changeSlot(changes, action.slot, action.draft)
    case 'slotItem':
      return changeSlotItem(changes, action.slotItem, action.id)
    case 'reset':
      return NO_CHANGES
  }
}

/**
 * 바꾼 부위만 화면의 부위 순서대로 넣어, 같은 변경은 늘 같은 요청이 된다. 칭호, 크리쳐, 오라는 고른 것만 넣고, 장비를
 * 바꾸지 않았어도 equipment는 빈 배열로 보낸다.
 */
export function simulationBody(
  rows: readonly SimulatorRow[],
  changes: SimulatorChanges
): SimulationBody {
  const equipment = rows.flatMap((row) => {
    if (row.kind !== 'equipment') {
      return []
    }

    const draft = changes.equipment[row.slot.slotId]

    if (draft === undefined) {
      return []
    }

    return [{ slotId: row.slot.slotId, ...draft }]
  })

  return { equipment, ...changes.slotItems }
}

export function hasChanges(changes: SimulatorChanges): boolean {
  const changedEquipment = Object.keys(changes.equipment).length > 0
  const changedSlotItems = Object.keys(changes.slotItems).length > 0

  return changedEquipment || changedSlotItems
}
