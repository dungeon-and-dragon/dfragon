import { type SlotItem, type SlotItemCategory, findSlotItem } from '@dfragon/lib/slot-items'
import { isRecord } from '@dfragon/lib/utils/shape-check'
import type {
  CharacterPayload,
  CharacterPayloads
} from '@dfragon/server-core/domain/character-detail/index.js'
import type { ScoreSimulationInput } from '@dfragon/server-core/domain/score/index.js'
import { EquipmentSimulationFailure } from './failure.js'

/** 묶음 id이고, null이면 착용한 아이템을 그대로 둔다. */
export type SlotItemChanges = Readonly<Record<SlotItemCategory, string | null>>

interface SlotItemEdit {
  readonly original: CharacterPayload
  readonly slotItem: SlotItem
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

function editOf(
  payloads: CharacterPayloads,
  category: SlotItemCategory,
  id: string | null
): SlotItemEdit | null {
  if (id === null) {
    return null
  }

  const slotItem = findSlotItem(category, id)
  const original = originalOf(payloads, category)

  // 엔진은 원본 항목의 나머지 칸을 그대로 쓰므로, 착용하지 않은 부위는 만들 수 없어 거절한다.
  if (slotItem === null || original === null) {
    throw new EquipmentSimulationFailure('request')
  }

  return { original, slotItem }
}

/** 그 카테고리의 목록에 없는 id나 원본에 없는 부위는 거절한다. */
export function editSlotItems(
  payloads: CharacterPayloads,
  changes: SlotItemChanges
): SlotItemEdits {
  const title = editOf(payloads, 'title', changes.title)
  const creature = editOf(payloads, 'creature', changes.creature)
  const aura = editOf(payloads, 'aura', changes.aura)

  return { title, creature, aura }
}

export function hasSlotItemEdits(edits: SlotItemEdits): boolean {
  return edits.title !== null || edits.creature !== null || edits.aura !== null
}

/** 엔진이 새 아이템의 상세를 최상위 `items`에서 읽으므로 함께 조회할 아이템이다. */
export function slotItemIds(edits: SlotItemEdits): string[] {
  return [edits.title, edits.creature, edits.aura].flatMap((edit) => {
    if (edit === null) {
      return []
    }

    return [edit.slotItem.item.itemId]
  })
}

function replacedItem(edit: SlotItemEdit): CharacterPayload {
  const item = structuredClone(edit.original)
  const { itemId, itemName, itemRarity } = edit.slotItem.item

  item.itemId = itemId
  item.itemName = itemName
  item.itemRarity = itemRarity

  return item
}

function simulatedTitle(
  edit: SlotItemEdit,
  detail: CharacterPayload | undefined
): CharacterPayload {
  const title = replacedItem(edit)

  if (typeof detail?.itemAvailableLevel === 'number') {
    title.itemAvailableLevel = detail.itemAvailableLevel
  }

  return title
}

// 모션 오라는 clone 칸의 아이템이 실제 효과를 내므로, 바꾼 오라가 적용되게 clone을 비운다.
function simulatedAura(edit: SlotItemEdit): CharacterPayload {
  const aura = replacedItem(edit)
  aura.clone = { itemId: null, itemName: null }

  return aura
}

function simulatedOf(
  edit: SlotItemEdit | null,
  simulate: (edit: SlotItemEdit) => CharacterPayload
): CharacterPayload | null {
  if (edit === null) {
    return null
  }

  return simulate(edit)
}

/** 원본 항목을 깊은 복사해 아이템 칸만 바꾸고, 칭호 마법부여, 크리쳐 아티팩트, 오라 엠블렘은 그대로 둔다. */
export function simulatedSlotItems(
  edits: SlotItemEdits,
  details: ReadonlyMap<string, CharacterPayload>
): SimulatedSlotItems {
  const title = simulatedOf(edits.title, (edit) =>
    simulatedTitle(edit, details.get(edit.slotItem.item.itemId))
  )
  const creature = simulatedOf(edits.creature, replacedItem)
  const aura = simulatedOf(edits.aura, simulatedAura)

  return { title, creature, aura }
}

/** 칭호는 장비 목록에, 크리쳐, 아바타, 서약, 버프 강화 레벨은 각자의 칸에 넣고, 바꾸지 않은 칸은 보내지 않는다. */
export function simulationInputOf(
  equipment: readonly CharacterPayload[],
  slots: Pick<SimulatedSlotItems, 'title' | 'creature'>,
  avatar: readonly CharacterPayload[],
  oath: ScoreSimulationInput['oath'] | null,
  buffLevel: number | null
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

  if (buffLevel !== null) {
    simulation.buff = { level: buffLevel }
  }

  return simulation
}
