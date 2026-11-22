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

interface SlotItemTable {
  readonly version: 1
  readonly categories: Readonly<Record<SlotItemCategory, readonly SlotItem[]>>
}

// 엔진 저장소의 선택 목록에 운영에서 관측한 대표 아이템을 붙인 파일을 그대로 두므로 모양은 테스트가 확인한다.
const slotItems = table as SlotItemTable

export function slotItemsOf(category: SlotItemCategory): readonly SlotItem[] {
  return slotItems.categories[category]
}

export function findSlotItem(category: SlotItemCategory, id: string): SlotItem | null {
  const found = slotItems.categories[category].find((slotItem) => slotItem.id === id)

  if (found === undefined) {
    return null
  }

  return found
}
