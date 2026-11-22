import observed from './slot-item-ids.json' with { type: 'json' }
import table from './slot-items.json' with { type: 'json' }

export const SLOT_ITEM_CATEGORIES = ['title', 'creature', 'aura'] as const

export type SlotItemCategory = (typeof SLOT_ITEM_CATEGORIES)[number]

export interface SlotItemStatus {
  readonly name: string
  readonly value: number | string
}

export interface SlotItemBuff {
  readonly buffAmp: number
  readonly buffPower: number
  readonly skills: readonly string[]
  readonly otherSkills: readonly string[]
}

/** 엔진 점수 효과가 같은 아이템의 묶음이다. item은 묶음을 대표해 엔진에 넘길 Neople 아이템이다. */
export interface SlotItem {
  readonly id: string
  readonly fame: number
  readonly name: string
  readonly status: readonly SlotItemStatus[]
  readonly buff: SlotItemBuff
  readonly item: {
    readonly itemId: string
    readonly itemName: string
    readonly itemRarity: string
  }
}

type EngineSlotItem = Omit<SlotItem, 'item'>

interface EngineSlotItemTable {
  readonly version: 1
  readonly categories: Readonly<Record<SlotItemCategory, readonly EngineSlotItem[]>>
}

interface ObservedSlotItem {
  readonly itemId: string
  readonly itemName: string
  readonly itemRarity: string
  readonly name?: string
}

interface SlotItemIdTable {
  readonly items: Readonly<Record<string, ObservedSlotItem>>
}

// 엔진 저장소의 선택 목록과 제품이 운영 관측으로 관리하는 대표 아이템을 그대로 두므로 모양은 테스트가 확인한다.
const engineSlotItems = table as EngineSlotItemTable
const observedItems = (observed as SlotItemIdTable).items

// 운영에서 관측되지 않아 엔진에 넘길 대표 아이템이 없는 묶음은 고를 수 없으므로 목록에서 뺀다.
function withObservedItem(slotItem: EngineSlotItem): SlotItem[] {
  const observedItem = observedItems[slotItem.id]

  if (observedItem === undefined) {
    return []
  }

  const { itemId, itemName, itemRarity, name = slotItem.name } = observedItem
  const { id, fame, status, buff } = slotItem

  return [{ id, fame, name, status, buff, item: { itemId, itemName, itemRarity } }]
}

const titles = engineSlotItems.categories.title.flatMap(withObservedItem)
const creatures = engineSlotItems.categories.creature.flatMap(withObservedItem)
const auras = engineSlotItems.categories.aura.flatMap(withObservedItem)
const slotItems: Readonly<Record<SlotItemCategory, readonly SlotItem[]>> = {
  title: titles,
  creature: creatures,
  aura: auras
}

export function slotItemsOf(category: SlotItemCategory): readonly SlotItem[] {
  return slotItems[category]
}

export function findSlotItem(category: SlotItemCategory, id: string): SlotItem | null {
  const found = slotItems[category].find((slotItem) => slotItem.id === id)

  if (found === undefined) {
    return null
  }

  return found
}
