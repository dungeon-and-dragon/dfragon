import {
  ENCHANT_GRADE_SLOTS,
  type EnchantGradeSlot,
  type EnchantGradeTier,
  enchantOptionsOf
} from '@dfragon/lib/enchant-grades'
import {
  EQUIPMENT_VARIANT_SLOTS,
  type EquipmentSet,
  type OathUpgradeSelection,
  type EquipmentVariant,
  type EquipmentVariantSlot,
  equipmentSets,
  equipmentVariantsOf,
  findEquipmentVariant,
  resolveEquipmentItems,
  switchEquipmentSet,
  weaponMaxTuneLevelOf
} from '@dfragon/lib/equipment-variants'
import type { BuffSwitching } from '@dfragon/lib/buff-switching'
import { type SlotItemCategory, slotItemsOf } from '@dfragon/lib/slot-items'
import {
  type CharacterDetailView,
  type EnchantOption,
  type EnchantRole,
  type ItemView,
  itemRarityOfGrade,
  toItemView
} from '#entities/character'
import { equippedEnchantLabels, optionEnchantLabels } from './enchant-label'
import type { AvatarPresetChange } from './simulator-avatar'
import {
  changeUpgradeOathpoint,
  changeUpgradeUnlock,
  type SimulatorOathUpgrade
} from './simulator-oath-upgrade'
import {
  type CrystalDraft,
  changeCrystal,
  changeOathBody,
  changeOathSet,
  hasOathChanges,
  NO_OATH_CHANGES,
  type OathChanges,
  type OathCrystalChange,
  oathCrystalChanges,
  type SimulatorOath,
  type SimulatorOathBody,
  type SimulatorOathCrystal
} from './simulator-oath'
import { type BuffLevelChange, changeBuffLevel } from './simulator-switching'

type EquipmentItem = CharacterDetailView['equipment']['equipment'][number]
type SetItem = CharacterDetailView['equipment']['setItemInfo'][number]
type SimulatorDetail = Pick<CharacterDetailView, 'equipment' | 'card' | 'creature' | 'avatar'>
type WornItem = Parameters<typeof toItemView>[0]

const TITLE_SLOT_ID = 'TITLE'
const WEAPON_SLOT_ID = 'WEAPON'
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
const EXALTED_KIND = '유일'
export const FULL_POTENCY = 100
// 응답의 정밀도 값 끝에 붙어 올 수 있는 퍼센트 기호다.
const POTENCY_PERCENT_SUFFIX = /%$/

export type EnchantChoice = Readonly<{
  id: string
  tier: EnchantGradeTier
  options: EnchantOption[]
}>

/** maxTune이 0이면 조율할 수 없는 아이템이다. */
export type VariantChoice = Readonly<{
  id: string
  itemId: string
  name: string
  rarity: ItemView['rarity']
  maxTune: number
  exalted: boolean
  variant: EquipmentVariant
}>

/**
 * wornVariantId, wornTune, wornPotency는 지금 기준의 아이템, 조율, 정밀도다. 장비 세트를 고르면 그 세트로 옮긴 값이고,
 * wornVariantId가 null이면 선택지에 없는 착용 아이템이다. wornMaxTune은 선택지에 없는 착용 아이템의 조율 상한이다(무기).
 */
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
    variants: readonly VariantChoice[]
    wornVariantId: string | null
    wornTune: number
    wornPotency: number | null
    wornMaxTune: number
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

/** 장비 세트 줄이다. mainSetId는 캐릭터의 주 세트이고, 세트를 고르지 않았을 때 선택된 세트다. */
export type SimulatorEquipmentSet = Readonly<{ mainSetId: string; sets: readonly EquipmentSet[] }>

/**
 * 부위의 원하는 상태다. `enchantId`가 null이면 착용한 마법부여를 그대로 두고, `variantId`가 null이면 선택지에 없는 착용
 * 아이템을 그대로 둔다. `potency`는 유일 장비일 때만 값이 있다.
 */
export type SlotDraft = Readonly<{
  reinforce: number
  amplified: boolean
  enchantId: string | null
  variantId: string | null
  tune: number
  potency: number | null
}>

/**
 * 고른 장비 세트, 기준과 다른 장비 부위, 바꾸려고 고른 칭호, 크리쳐, 오라 묶음 id, 아바타 프리셋, 버프 강화 스킬 레벨과
 * 서약의 바꾼 것만 담는다.
 */
export type SimulatorChanges = Readonly<{
  equipmentSet: string | null
  equipment: Readonly<Partial<Record<EnchantGradeSlot, SlotDraft>>>
  slotItems: Readonly<Partial<Record<SlotItemCategory, string>>>
  avatarPreset: AvatarPresetChange
  buffLevel: BuffLevelChange
  oath: OathChanges
}>

export const NO_CHANGES: SimulatorChanges = {
  equipmentSet: null,
  equipment: {},
  slotItems: {},
  avatarPreset: null,
  buffLevel: null,
  oath: NO_OATH_CHANGES
}

/** `variantId`, `tune`, `potency`가 null이면 착용 아이템의 값을 그대로 둔다. */
export type SimulationChange = Readonly<{
  slotId: EnchantGradeSlot
  reinforce: number
  amplified: boolean
  enchantId: string | null
  variantId: string | null
  tune: number | null
  potency: number | null
}>

export type SimulationBody = Readonly<
  {
    equipmentSet?: string
    equipment: SimulationChange[]
    oathSet?: number
    oathBody?: string
    oathUpgrade?: readonly OathUpgradeSelection[]
    oath?: OathCrystalChange[]
    avatarPreset?: NonNullable<AvatarPresetChange>
    buffLevel?: number
  } & Partial<Record<SlotItemCategory, string>>
>

/** rows와 oath는 세트를 옮기기 전의 줄과 서약이고, slot, body, crystal은 지금 기준으로 옮긴 것이다. */
export type SimulatorAction =
  | Readonly<{
      type: 'equipmentSet'
      rows: readonly SimulatorRow[]
      equipmentSet: SimulatorEquipmentSet
      setItemId: string
    }>
  | Readonly<{ type: 'change'; slot: SimulatorSlot; draft: Partial<SlotDraft> }>
  | Readonly<{ type: 'slotItem'; slotItem: SimulatorSlotItem; id: string | null }>
  | Readonly<{ type: 'avatarPreset'; preset: AvatarPresetChange }>
  | Readonly<{ type: 'buffLevel'; switching: BuffSwitching; level: number }>
  | Readonly<{ type: 'oathSet'; oath: SimulatorOath; setId: number }>
  | Readonly<{ type: 'oathBody'; body: SimulatorOathBody; id: string }>
  | Readonly<{
      type: 'oathUpgradeUnlock'
      upgrade: SimulatorOathUpgrade
      step: number
      unlocked: boolean
    }>
  | Readonly<{
      type: 'oathUpgradeOathpoint'
      upgrade: SimulatorOathUpgrade
      step: number
      oathpoint: boolean
    }>
  | Readonly<{
      type: 'crystal'
      oath: SimulatorOath
      crystal: SimulatorOathCrystal
      draft: Partial<CrystalDraft>
    }>
  | Readonly<{ type: 'reset' }>

function isGradeSlot(slotId: string | null): slotId is EnchantGradeSlot {
  return ENCHANT_GRADE_SLOTS.some((gradeSlot) => gradeSlot === slotId)
}

function isVariantSlot(slotId: string): slotId is EquipmentVariantSlot {
  return EQUIPMENT_VARIANT_SLOTS.some((variantSlot) => variantSlot === slotId)
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

function maxTuneOf(tuneSetPoints: readonly number[]): number {
  return Math.max(0, tuneSetPoints.length - 1)
}

function toVariantChoice(variant: EquipmentVariant): VariantChoice {
  const { itemId, itemName, itemRarity } = variant.item
  const rarity = itemRarityOfGrade(itemRarity)
  const maxTune = maxTuneOf(variant.tuneSetPoints)
  const exalted = variant.kind === EXALTED_KIND

  return {
    id: variant.id,
    itemId,
    name: itemName,
    rarity,
    maxTune,
    exalted,
    variant
  }
}

// API처럼 세트 포인트와 setItemId가 있는 세트만 세트 포인트가 큰 순서로 두고, 같은 포인트면 앞 세트를 앞에 둔다.
function setIdsByPointOf(setItemInfo: readonly SetItem[]): string[] {
  const candidates = setItemInfo.flatMap(({ setItemId, active }) => {
    const point = active?.setPoint?.current

    if (setItemId === null || point == null) {
      return []
    }

    return [{ setItemId, point }]
  })

  return candidates.toSorted((a, b) => b.point - a.point).map(({ setItemId }) => setItemId)
}

/**
 * 낀 아이템 세트의 선택지를 둔다. 세트 밖 장비나 선택 목록에 없는 세트의 장비를 낀 부위는 캐릭터의 주 세트(선택 목록에 있는
 * 세트 가운데 세트 포인트가 가장 큰 세트)의 선택지를 둔다.
 */
function variantChoicesOf(
  item: EquipmentItem,
  slotId: EnchantGradeSlot,
  setIdsByPoint: readonly string[]
): VariantChoice[] {
  if (!isVariantSlot(slotId)) {
    return []
  }

  const setIds = item.setItemId !== null ? [item.setItemId, ...setIdsByPoint] : setIdsByPoint
  const variants = setIds
    .map((setId) => equipmentVariantsOf(setId, slotId))
    .find((found) => found.length > 0)

  if (variants === undefined) {
    return []
  }

  return variants.map(toVariantChoice)
}

function wornVariantIdOf(item: EquipmentItem, variants: readonly VariantChoice[]): string | null {
  const match = item.itemId !== null ? findEquipmentVariant(item.itemId) : null
  const worn = variants.find(({ id }) => id === match?.variant.id)

  if (worn === undefined) {
    return null
  }

  return worn.id
}

function wornTuneOf(item: EquipmentItem): number {
  const levels = item.tune.flatMap(({ level }) => (level != null ? [level] : []))

  return Math.max(0, ...levels)
}

function potencyOf(item: EquipmentItem): number | null {
  const value = item.potency?.value

  if (value == null) {
    return null
  }

  const potency = Number(String(value).replace(POTENCY_PERCENT_SUFFIX, ''))

  if (!Number.isInteger(potency)) {
    return null
  }

  return potency
}

function wornPotencyOf(
  item: EquipmentItem,
  variants: readonly VariantChoice[],
  wornVariantId: string | null
): number | null {
  const worn = variants.find(({ id }) => id === wornVariantId)

  if (worn?.exalted !== true) {
    return null
  }

  const potency = potencyOf(item)

  if (potency === null) {
    return FULL_POTENCY
  }

  return potency
}

function toSimulatorSlot(
  item: EquipmentItem & { slotId: EnchantGradeSlot },
  role: EnchantRole,
  setIdsByPoint: readonly string[]
): SimulatorSlot {
  const reinforce = item.reinforce ?? 0
  const itemView = toItemView(item)
  const amplified = item.amplificationName != null
  const reinforceLimit = Math.max(REINFORCE_LIMIT, reinforce)
  const reinforceEditable = item.itemAvailableLevel === SIMULATED_ITEM_LEVEL
  const enchants = equippedEnchantLabels(item.enchant, role)
  const choices = enchantChoices(item.slotId, role)
  const variants = variantChoicesOf(item, item.slotId, setIdsByPoint)
  const wornVariantId = wornVariantIdOf(item, variants)
  const wornTune = wornTuneOf(item)
  const wornPotency = wornPotencyOf(item, variants, wornVariantId)
  const wornMaxTune = item.slotId === WEAPON_SLOT_ID ? weaponMaxTuneLevelOf(item.itemName ?? '') : 0

  return {
    ...itemView,
    slotId: item.slotId,
    slotName: item.slotName,
    reinforce,
    amplified,
    reinforceLimit,
    reinforceEditable,
    enchants,
    enchantChoices: choices,
    variants,
    wornVariantId,
    wornTune,
    wornPotency,
    wornMaxTune
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

/** 캐릭터의 주 세트가 선택 목록에 있으면 장비 세트 줄을 둔다. */
export function toEquipmentSet(
  detail: Pick<CharacterDetailView, 'equipment'>
): SimulatorEquipmentSet | null {
  const sets = equipmentSets()
  const listed = new Set(sets.map(({ setItemId }) => setItemId))
  const mainSetId = setIdsByPointOf(detail.equipment.setItemInfo).find((setItemId) =>
    listed.has(setItemId)
  )

  if (mainSetId === undefined) {
    return null
  }

  return { mainSetId, sets }
}

export function equipmentSetIdOf(
  equipmentSet: SimulatorEquipmentSet,
  changes: SimulatorChanges
): string {
  if (changes.equipmentSet === null) {
    return equipmentSet.mainSetId
  }

  return changes.equipmentSet
}

export function equipmentSetNameOf(
  equipmentSet: SimulatorEquipmentSet,
  changes: SimulatorChanges
): string | null {
  const setItemId = equipmentSetIdOf(equipmentSet, changes)
  const current = equipmentSet.sets.find((set) => set.setItemId === setItemId)

  if (current === undefined) {
    return null
  }

  return current.setItemName
}

function slotInSet(slot: SimulatorSlot, setItemId: string): SimulatorSlot {
  const { slotId } = slot

  if (!isVariantSlot(slotId)) {
    return slot
  }

  const variants = equipmentVariantsOf(setItemId, slotId).map(toVariantChoice)
  const worn = variantChoiceOf(slot, slot.wornVariantId)
  const switched = switchEquipmentSet({ [slotId]: worn?.variant ?? null }, setItemId)[slotId]
  const keepsWorn = variants.some(({ id }) => id === slot.wornVariantId)
  const wornVariantId = switched?.id ?? (keepsWorn ? slot.wornVariantId : null)
  const choice = variants.find(({ id }) => id === wornVariantId)
  const wornTune = choice !== undefined ? Math.min(slot.wornTune, choice.maxTune) : slot.wornTune

  return { ...slot, variants, wornVariantId, wornTune }
}

/**
 * 고른 장비 세트로 옮긴 줄이다. 세트를 고르지 않았으면 그대로다. 무기를 뺀 11부위는 그 세트의 같은 등급, 같은 종류가 되고,
 * 유일 장비와 선택지에 없는 착용 아이템은 그대로 둔다.
 */
export function rowsInEquipmentSet(
  rows: readonly SimulatorRow[],
  setItemId: string | null
): readonly SimulatorRow[] {
  if (setItemId === null) {
    return rows
  }

  return rows.map((row) => {
    if (row.kind !== 'equipment') {
      return row
    }

    return { kind: 'equipment', slot: slotInSet(row.slot, setItemId) }
  })
}

/** 칭호는 응답의 부위 순서 자리에, 크리쳐와 오라는 캐릭터 상세 장비 탭처럼 장비 뒤에 둔다. 장비는 등급표의 12부위만 둔다. */
export function toSimulatorRows(detail: SimulatorDetail): SimulatorRow[] {
  const role = simulatorRole(detail.card)
  const setIdsByPoint = setIdsByPointOf(detail.equipment.setItemInfo)
  const equipment = detail.equipment.equipment.flatMap((item): SimulatorRow[] => {
    const { slotId } = item

    if (slotId === TITLE_SLOT_ID) {
      return slotItemRow('title', item, item.slotName)
    }

    if (!isGradeSlot(slotId)) {
      return []
    }

    const slot = toSimulatorSlot({ ...item, slotId }, role, setIdsByPoint)

    return [{ kind: 'equipment', slot }]
  })

  const aura = detail.avatar.find(({ slotId }) => slotId === AURA_SLOT_ID)

  return [...equipment, ...slotItemRow('creature', detail.creature), ...slotItemRow('aura', aura)]
}

function originalDraft(slot: SimulatorSlot): SlotDraft {
  return {
    reinforce: slot.reinforce,
    amplified: slot.amplified,
    enchantId: null,
    variantId: slot.wornVariantId,
    tune: slot.wornTune,
    potency: slot.wornPotency
  }
}

export function draftOf(slot: SimulatorSlot, changes: SimulatorChanges): SlotDraft {
  const changed = changes.equipment[slot.slotId]

  if (changed === undefined) {
    return originalDraft(slot)
  }

  return changed
}

/** 고른 마법부여의 옵션이다. 고르지 않았거나 등급표에 없는 id면 착용한 마법부여다. */
export function enchantLabelsOf(
  slot: SimulatorSlot,
  enchantId: string | null
): readonly EnchantOption[] {
  const choice = slot.enchantChoices.find(({ id }) => id === enchantId)

  if (choice === undefined) {
    return slot.enchants
  }

  return choice.options
}

export function variantChoiceOf(
  slot: SimulatorSlot,
  variantId: string | null
): VariantChoice | undefined {
  return slot.variants.find(({ id }) => id === variantId)
}

function isOriginal(slot: SimulatorSlot, draft: SlotDraft): boolean {
  const original = originalDraft(slot)

  return (
    draft.reinforce === original.reinforce &&
    draft.amplified === original.amplified &&
    draft.enchantId === original.enchantId &&
    draft.variantId === original.variantId &&
    draft.tune === original.tune &&
    draft.potency === original.potency
  )
}

function isInRange(value: number, max: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= max
}

/** 그 상태의 조율 상한이다. 0이면 조율할 수 없다. */
export function tuneLimitOf(slot: SimulatorSlot, variantId: string | null): number {
  const choice = variantChoiceOf(slot, variantId)

  if (choice === undefined) {
    return slot.wornMaxTune
  }

  return choice.maxTune
}

function isTuneAllowed(slot: SimulatorSlot, draft: SlotDraft): boolean {
  return draft.tune === slot.wornTune || isInRange(draft.tune, tuneLimitOf(slot, draft.variantId))
}

function isPotencyAllowed(slot: SimulatorSlot, draft: SlotDraft): boolean {
  const choice = variantChoiceOf(slot, draft.variantId)

  if (choice?.exalted !== true) {
    return draft.potency === null
  }

  return draft.potency !== null && isInRange(draft.potency, FULL_POTENCY)
}

function isAllowed(slot: SimulatorSlot, current: SlotDraft, next: SlotDraft): boolean {
  const changesReinforce =
    next.reinforce !== current.reinforce || next.amplified !== current.amplified

  if (changesReinforce && !slot.reinforceEditable) {
    return false
  }

  if (!isInRange(next.reinforce, slot.reinforceLimit)) {
    return false
  }

  if (next.enchantId !== null && !slot.enchantChoices.some(({ id }) => id === next.enchantId)) {
    return false
  }

  const knownVariant =
    next.variantId === slot.wornVariantId || variantChoiceOf(slot, next.variantId) !== undefined

  return knownVariant && isTuneAllowed(slot, next) && isPotencyAllowed(slot, next)
}

/**
 * 아이템을 바꾸면 조율은 바꾼 아이템의 최대 단계까지 유지하고, 유일 장비의 정밀도는 착용한 값이나 100에서 시작한다. 선택지에
 * 없는 착용 아이템으로 되돌리면 착용한 조율로 둔다.
 */
function switchVariant(
  slot: SimulatorSlot,
  current: SlotDraft,
  variantId: string | null
): SlotDraft {
  if (variantId === current.variantId) {
    return current
  }

  const choice = variantChoiceOf(slot, variantId)

  if (choice === undefined) {
    return { ...current, variantId, tune: slot.wornTune, potency: null }
  }

  const tune = Math.min(current.tune, choice.maxTune)
  const potency = choice.exalted ? (slot.wornPotency ?? FULL_POTENCY) : null

  return { ...current, variantId, tune, potency }
}

function changeSlot(
  changes: SimulatorChanges,
  slot: SimulatorSlot,
  draft: Partial<SlotDraft>
): SimulatorChanges {
  const current = draftOf(slot, changes)
  const { variantId, ...values } = draft
  const switched = variantId !== undefined ? switchVariant(slot, current, variantId) : current
  const next = { ...switched, ...values }

  if (!isAllowed(slot, current, next)) {
    return changes
  }

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

/**
 * 장비 세트를 바꾸면 지금 보이는 부위마다의 아이템을 새 세트의 같은 등급, 같은 종류로 옮기고, 강화, 증폭, 마법부여와 조율은
 * 새 아이템의 최대 단계까지 유지한다. 유일 장비와 선택지에 없는 착용 아이템은 그대로 둔다. 그 세트를 골라도 바뀌는 부위가
 * 없으면(세트에 속한 부위가 모두 이미 그 세트) 세트를 고르지 않은 것으로 둔다.
 */
function changeEquipmentSet(
  changes: SimulatorChanges,
  rows: readonly SimulatorRow[],
  equipmentSet: SimulatorEquipmentSet,
  setItemId: string
): SimulatorChanges {
  if (!equipmentSet.sets.some((set) => set.setItemId === setItemId)) {
    return changes
  }

  const current = rowsInEquipmentSet(rows, changes.equipmentSet)
  const chosen = movesSlots(rows, setItemId) ? setItemId : null
  const next = rowsInEquipmentSet(rows, chosen)
  const equipment = Object.fromEntries(
    next.flatMap((row, index): [EnchantGradeSlot, SlotDraft][] => {
      const currentRow = current[index]

      if (row.kind !== 'equipment' || currentRow?.kind !== 'equipment') {
        return []
      }

      const { slot } = row
      const moved = movedDraftOf(
        draftOf(currentRow.slot, changes),
        currentRow.slot,
        slot,
        setItemId
      )

      if (isOriginal(slot, moved)) {
        return []
      }

      return [[slot.slotId, moved]]
    })
  )

  return { ...changes, equipmentSet: chosen, equipment }
}

function movesSlots(rows: readonly SimulatorRow[], setItemId: string): boolean {
  const moved = rowsInEquipmentSet(rows, setItemId)

  return rows.some((row, index) => {
    const movedRow = moved[index]

    if (row.kind !== 'equipment' || movedRow?.kind !== 'equipment') {
      return false
    }

    const sameChoices =
      row.slot.variants.length === movedRow.slot.variants.length &&
      row.slot.variants.every(({ id }, position) => movedRow.slot.variants[position]?.id === id)

    return !sameChoices || row.slot.wornVariantId !== movedRow.slot.wornVariantId
  })
}

function movedDraftOf(
  draft: SlotDraft,
  current: SimulatorSlot,
  next: SimulatorSlot,
  setItemId: string
): SlotDraft {
  const { slotId } = next

  if (!isVariantSlot(slotId)) {
    return draft
  }

  const chosen = variantChoiceOf(current, draft.variantId)

  // 선택지 밖 착용 아이템은 옮길 짝이 없어 세트를 바꿔도 조율까지 그대로 둔다.
  if (chosen === undefined) {
    return draft
  }

  const switched = switchEquipmentSet({ [slotId]: chosen.variant }, setItemId)[slotId]
  const keeps = next.variants.some(({ id }) => id === draft.variantId)
  const variantId = switched?.id ?? (keeps ? draft.variantId : next.wornVariantId)
  const choice = variantChoiceOf(next, variantId)
  const tune = Math.min(draft.tune, tuneLimitOf(next, variantId))
  const potency = choice?.exalted === true ? (draft.potency ?? FULL_POTENCY) : null

  return { ...draft, variantId, tune, potency }
}

export function simulatorReducer(
  changes: SimulatorChanges,
  action: SimulatorAction
): SimulatorChanges {
  switch (action.type) {
    case 'equipmentSet':
      return changeEquipmentSet(changes, action.rows, action.equipmentSet, action.setItemId)
    case 'change':
      return changeSlot(changes, action.slot, action.draft)
    case 'slotItem':
      return changeSlotItem(changes, action.slotItem, action.id)
    case 'avatarPreset':
      return { ...changes, avatarPreset: action.preset }
    case 'buffLevel': {
      const buffLevel = changeBuffLevel(action.switching, changes.buffLevel, action.level)

      return { ...changes, buffLevel }
    }
    case 'oathSet': {
      const oath = changeOathSet(changes.oath, action.oath, action.setId)

      return { ...changes, oath }
    }
    case 'oathBody': {
      const oath = changeOathBody(changes.oath, action.body, action.id)

      return { ...changes, oath }
    }
    case 'oathUpgradeUnlock': {
      const upgrade = changeUpgradeUnlock(
        action.upgrade,
        changes.oath.upgrade,
        action.step,
        action.unlocked
      )

      return { ...changes, oath: { ...changes.oath, upgrade } }
    }
    case 'oathUpgradeOathpoint': {
      const upgrade = changeUpgradeOathpoint(
        action.upgrade,
        changes.oath.upgrade,
        action.step,
        action.oathpoint
      )

      return { ...changes, oath: { ...changes.oath, upgrade } }
    }
    case 'crystal': {
      const oath = changeCrystal(changes.oath, action.oath, action.crystal, action.draft)

      return { ...changes, oath }
    }
    case 'reset':
      return NO_CHANGES
  }
}

/**
 * 선택한 아이템이 실제로 어떤 아이템이 되는지 부위별로 돌려준다. 방어구 5부위가 모두 축성이면 세트 공용 이름 아이템이 된다.
 * 선택지에 없는 착용 아이템을 그대로 둔 부위는 넣지 않는다.
 */
export function resolvedItemsOf(
  rows: readonly SimulatorRow[],
  changes: SimulatorChanges
): Readonly<Partial<Record<EnchantGradeSlot, ItemView>>> {
  const selection = Object.fromEntries(
    rows.flatMap((row): [EquipmentVariantSlot, EquipmentVariant][] => {
      if (row.kind !== 'equipment' || !isVariantSlot(row.slot.slotId)) {
        return []
      }

      const choice = variantChoiceOf(row.slot, draftOf(row.slot, changes).variantId)

      if (choice === undefined) {
        return []
      }

      return [[row.slot.slotId, choice.variant]]
    })
  )

  const items = resolveEquipmentItems(selection)

  return Object.fromEntries(
    Object.entries(items).map(([slotId, item]) => [slotId, toItemView(item)])
  )
}

function toSimulationChange(slot: SimulatorSlot, draft: SlotDraft): SimulationChange {
  const variantId = draft.variantId === slot.wornVariantId ? null : draft.variantId
  const keepsItem = variantId === null
  const tune = keepsItem && draft.tune === slot.wornTune ? null : draft.tune
  const potency = keepsItem && draft.potency === slot.wornPotency ? null : draft.potency

  return {
    slotId: slot.slotId,
    reinforce: draft.reinforce,
    amplified: draft.amplified,
    enchantId: draft.enchantId,
    variantId,
    tune,
    potency
  }
}

/**
 * 바꾼 것만 화면의 순서대로 넣어, 같은 변경은 늘 같은 요청이 된다. 장비를 바꾸지 않았어도 equipment는 빈 배열로 보낸다.
 * rows와 oath는 고른 세트로 옮긴 줄과 서약이다. 세트 전환과 5축성 변환으로 바뀌는 다른 부위와 결정은 서버가 계산하므로,
 * 세트만 고르면 세트만 넣고 따로 바꾼 부위와 결정만 넣는다.
 */
export function simulationBody(
  rows: readonly SimulatorRow[],
  oath: SimulatorOath | null,
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

    return [toSimulationChange(row.slot, draft)]
  })
  const crystals = oathCrystalChanges(oath, changes.oath)
  const equipmentSet = changes.equipmentSet !== null ? { equipmentSet: changes.equipmentSet } : {}
  const oathSet = changes.oath.set !== null ? { oathSet: changes.oath.set } : {}
  const oathBody = changes.oath.body !== null ? { oathBody: changes.oath.body } : {}
  const oathUpgrade = changes.oath.upgrade !== null ? { oathUpgrade: changes.oath.upgrade } : {}
  const crystalChanges = crystals.length > 0 ? { oath: crystals } : {}
  const avatarPreset = changes.avatarPreset !== null ? { avatarPreset: changes.avatarPreset } : {}
  const buffLevel = changes.buffLevel !== null ? { buffLevel: changes.buffLevel } : {}

  return {
    ...equipmentSet,
    equipment,
    ...changes.slotItems,
    ...avatarPreset,
    ...buffLevel,
    ...oathSet,
    ...oathBody,
    ...oathUpgrade,
    ...crystalChanges
  }
}

export function hasChanges(changes: SimulatorChanges): boolean {
  const changedEquipment = Object.keys(changes.equipment).length > 0
  const changedSlotItems = Object.keys(changes.slotItems).length > 0
  const changedSet = changes.equipmentSet !== null
  const changedAvatar = changes.avatarPreset !== null
  const changedBuffLevel = changes.buffLevel !== null

  return (
    changedSet ||
    changedEquipment ||
    changedSlotItems ||
    changedAvatar ||
    changedBuffLevel ||
    hasOathChanges(changes.oath)
  )
}
