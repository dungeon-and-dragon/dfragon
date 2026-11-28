import { SLOT_ITEM_CATEGORIES, type SlotItemCategory } from '@dfragon/lib/lab-items'
import { isRecord } from '@dfragon/lib/utils/shape-check'
import type {
  CharacterPayload,
  CharacterPayloads
} from '@dfragon/server-core/domain/character-detail/index.js'
import type { ScoreSimulationInput } from '@dfragon/server-core/domain/score/index.js'
import {
  findLabSlotItemOption,
  type LabEnchantCardPrice,
  type LabSlotItem,
  type LabSlotItemGroup
} from '#domain/lab-enchant-options/index.js'
import { EquipmentSimulationFailure } from './failure.js'

export type LabSlotItemGroups = readonly LabSlotItemGroup<LabEnchantCardPrice>[]

/** 실험실 선택지 id이고, null이면 착용한 아이템을 그대로 둔다. */
export type SlotItemChanges = Readonly<Record<SlotItemCategory, string | null>>

interface SlotItemEdit {
  /** 비어 있는 부위면 부위 칸만 있는 항목이다. */
  readonly original: CharacterPayload
  /** 원본에 없는 부위에 더하는지다. */
  readonly added: boolean
  readonly item: LabSlotItem
}

export type SlotItemEdits = Readonly<Record<SlotItemCategory, SlotItemEdit | null>>

export interface SimulatedSlotItems {
  readonly title: CharacterPayload | null
  readonly creature: CharacterPayload | null
  readonly aura: CharacterPayload | null
}

function hasItem(value: unknown): value is CharacterPayload {
  return isRecord(value) && typeof value.itemId === 'string'
}

function slotOf(section: CharacterPayload, key: string, slotId: string): CharacterPayload | null {
  const items = section[key]

  if (!Array.isArray(items)) {
    return null
  }

  const found = items.find((item) => isRecord(item) && item.slotId === slotId)

  if (!hasItem(found)) {
    return null
  }

  return found
}

function originalOf(
  payloads: CharacterPayloads,
  category: SlotItemCategory
): CharacterPayload | null {
  if (category === 'title') {
    return slotOf(payloads.equipment, 'equipment', 'TITLE')
  }

  if (category === 'aura') {
    return slotOf(payloads.avatar, 'avatar', 'AURORA')
  }

  const { creature } = payloads.creature

  if (!hasItem(creature)) {
    return null
  }

  return creature
}

// 엔진은 원본에 없는 칭호, 크리쳐, 오라를 아이템 칸만으로 더한다.
function emptyOf(category: SlotItemCategory): CharacterPayload {
  if (category === 'title') {
    return { slotId: 'TITLE' }
  }

  if (category === 'aura') {
    return { slotId: 'AURORA' }
  }

  return {}
}

function editOf(
  payloads: CharacterPayloads,
  category: SlotItemCategory,
  id: string | null,
  options: LabSlotItemGroups
): SlotItemEdit | null {
  if (id === null) {
    return null
  }

  const option = findLabSlotItemOption(options, category, id)

  if (option === null) {
    throw new EquipmentSimulationFailure('request')
  }

  const { item } = option
  const worn = originalOf(payloads, category)

  if (worn === null) {
    return { original: emptyOf(category), added: true, item }
  }

  return { original: worn, added: false, item }
}

export function changesSlotItems(changes: SlotItemChanges): boolean {
  return SLOT_ITEM_CATEGORIES.some((category) => changes[category] !== null)
}

/** 그 종류의 실험실 선택지에 없는 id는 거절하고, 비어 있는 부위는 고른 아이템을 더한다. */
export function editSlotItems(
  payloads: CharacterPayloads,
  changes: SlotItemChanges,
  options: LabSlotItemGroups
): SlotItemEdits {
  const title = editOf(payloads, 'title', changes.title, options)
  const creature = editOf(payloads, 'creature', changes.creature, options)
  const aura = editOf(payloads, 'aura', changes.aura, options)

  return { title, creature, aura }
}

export function hasSlotItemEdits(edits: SlotItemEdits): boolean {
  return edits.title !== null || edits.creature !== null || edits.aura !== null
}

export function addsSlotItems(edits: SlotItemEdits): boolean {
  return [edits.title, edits.creature, edits.aura].some((edit) => edit?.added === true)
}

/** 엔진이 새 아이템의 상세를 최상위 `items`에서 읽으므로 함께 조회할 아이템이다. */
export function slotItemIds(edits: SlotItemEdits): string[] {
  return [edits.title, edits.creature, edits.aura].flatMap((edit) => {
    if (edit === null) {
      return []
    }

    return [edit.item.itemId]
  })
}

// 엔진은 아이템 칸의 이름과 등급을 상세와 맞춰 보므로, 받은 Neople 상세의 값을 쓴다.
function replacedItem(edit: SlotItemEdit, detail: CharacterPayload | undefined): CharacterPayload {
  const item = structuredClone(edit.original)

  item.itemId = edit.item.itemId
  item.itemName = typeof detail?.itemName === 'string' ? detail.itemName : edit.item.itemName
  item.itemRarity = typeof detail?.itemRarity === 'string' ? detail.itemRarity : null

  return item
}

function simulatedTitle(
  edit: SlotItemEdit,
  detail: CharacterPayload | undefined
): CharacterPayload {
  const title = replacedItem(edit, detail)

  if (typeof detail?.itemAvailableLevel === 'number') {
    title.itemAvailableLevel = detail.itemAvailableLevel
  }

  return title
}

// 모션 오라는 clone 칸의 아이템이 실제 효과를 내므로, 바꾼 오라가 적용되게 clone을 비운다.
function simulatedAura(edit: SlotItemEdit, detail: CharacterPayload | undefined): CharacterPayload {
  const aura = replacedItem(edit, detail)
  aura.clone = { itemId: null, itemName: null }

  return aura
}

function simulatedOf(
  edit: SlotItemEdit | null,
  details: ReadonlyMap<string, CharacterPayload>,
  simulate: (edit: SlotItemEdit, detail: CharacterPayload | undefined) => CharacterPayload
): CharacterPayload | null {
  if (edit === null) {
    return null
  }

  return simulate(edit, details.get(edit.item.itemId))
}

/** 원본 항목을 깊은 복사해 아이템 칸만 바꾸고, 칭호 마법부여, 크리쳐 아티팩트, 오라 엠블렘은 그대로 둔다. */
export function simulatedSlotItems(
  edits: SlotItemEdits,
  details: ReadonlyMap<string, CharacterPayload>
): SimulatedSlotItems {
  const title = simulatedOf(edits.title, details, simulatedTitle)
  const creature = simulatedOf(edits.creature, details, replacedItem)
  const aura = simulatedOf(edits.aura, details, simulatedAura)

  return { title, creature, aura }
}

/** 칭호는 장비 목록에, 크리쳐, 아바타, 서약, 버프 강화 레벨과 짙편린 등록 수는 각자의 칸에 넣고, 바꾸지 않은 칸은 보내지 않는다. */
export function simulationInputOf(
  equipment: readonly CharacterPayload[],
  slots: Pick<SimulatedSlotItems, 'title' | 'creature'>,
  avatar: readonly CharacterPayload[],
  oath: ScoreSimulationInput['oath'] | null,
  buff: ScoreSimulationInput['buff'] | null
): ScoreSimulationInput {
  const { title, creature } = slots
  const simulation: { -readonly [K in keyof ScoreSimulationInput]: ScoreSimulationInput[K] } = {
    equipment
  }

  if (title !== null) {
    simulation.equipment = [...equipment, title]
  }

  if (creature !== null) {
    simulation.creature = creature
  }

  if (avatar.length > 0) {
    simulation.avatar = avatar
  }

  if (oath !== null) {
    simulation.oath = oath
  }

  if (buff !== null) {
    simulation.buff = buff
  }

  return simulation
}
