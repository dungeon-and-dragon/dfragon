import {
  isSameLabItem,
  LAB_ITEM_TIERS,
  type LabItemCategory,
  type LabItemGroupKey,
  type LabItemRole,
  type LabItemTier
} from '@dfragon/lib/lab-items'
import type { LabItem, LabItemCost, LabItemGroup } from '#ops-api/ops-schemas'
import { groupIdOf } from './lab-item-candidates'

export type TierSlot = { category: LabItemCategory; role: LabItemRole }

// cost는 등급을 바꿀 때 저장돼 있던 재화 비용이다. 옛 묶음 PUT만 성공한 뒤 다시 저장해도 비용을 잃지 않게 한다.
export type TierChange = TierSlot & {
  itemName: string
  tier: LabItemTier | null
  cost: LabItemCost | null
}

export type TierChanges = ReadonlyMap<string, TierChange>

type SavedEntry = { tier: LabItemTier; cost: LabItemCost | null; exact: boolean }

export function tierChangeIdOf({ category, role }: TierSlot, itemName: string): string {
  return `${category}:${role}:${itemName}`
}

function savedEntriesOf(
  groups: readonly LabItemGroup[],
  slot: TierSlot,
  itemName: string
): SavedEntry[] {
  return groups.flatMap((group) => {
    const tier = LAB_ITEM_TIERS.find((candidate) => candidate === group.tier)

    if (group.category !== slot.category || group.role !== slot.role || tier === undefined) {
      return []
    }

    return group.items
      .filter((item) => isSameLabItem(slot.category, item.itemName, itemName))
      .map((item) => ({ tier, cost: item.cost, exact: item.itemName === itemName }))
  })
}

function savedEntryOf(
  groups: readonly LabItemGroup[],
  slot: TierSlot,
  itemName: string
): SavedEntry | null {
  const entries = savedEntriesOf(groups, slot, itemName)
  const exact = entries.find((entry) => entry.exact)

  if (exact !== undefined) {
    return exact
  }

  if (entries.length === 0) {
    return null
  }

  return entries[0]
}

export function savedCostOf(
  groups: readonly LabItemGroup[],
  slot: TierSlot,
  itemName: string
): LabItemCost | null {
  const saved = savedEntryOf(groups, slot, itemName)

  if (saved === null) {
    return null
  }

  return saved.cost
}

export function savedTierOf(
  groups: readonly LabItemGroup[],
  slot: TierSlot,
  itemName: string
): LabItemTier | null {
  const saved = savedEntryOf(groups, slot, itemName)

  if (saved === null) {
    return null
  }

  return saved.tier
}

// 기본 이름 그대로 그 등급에만 저장돼 있을 때만 바꿀 것이 없다고 본다. 변형 이름으로 저장된 줄은 같은 등급을 골라도 기본 이름으로 바꿔 저장한다.
export function isSavedAs(
  groups: readonly LabItemGroup[],
  slot: TierSlot,
  itemName: string,
  tier: LabItemTier | null
): boolean {
  const entries = savedEntriesOf(groups, slot, itemName)

  if (tier === null) {
    return entries.length === 0
  }

  return entries.length === 1 && entries[0].exact && entries[0].tier === tier
}

// 일부 묶음만 저장된 뒤 다시 읽으면 이미 저장된 변경은 저장할 것에서 빠진다.
export function pendingTierChanges(
  groups: readonly LabItemGroup[],
  changes: TierChanges
): TierChange[] {
  return [...changes.values()].filter(
    (change) => !isSavedAs(groups, change, change.itemName, change.tier)
  )
}

// 묶음 PUT은 묶음 전체를 바꾸므로, 손대지 않은 아이템도 저장된 재화 비용과 함께 다시 보낸다.
// 등급을 옮긴 아이템은 옛 묶음의 재화 비용을 새 묶음으로 가져간다.
export function groupsToSave(
  groups: readonly LabItemGroup[],
  changes: TierChanges
): LabItemGroup[] {
  const pending = pendingTierChanges(groups, changes)
  const touched = new Map<string, LabItemGroup>()

  function groupOf(key: LabItemGroupKey): LabItemGroup {
    const id = groupIdOf(key)
    const existing = touched.get(id)

    if (existing !== undefined) {
      return existing
    }

    const saved = groups.find((group) => groupIdOf(group) === id)
    const items: LabItem[] = saved?.items ?? []
    const group = { ...key, items: [...items] }
    touched.set(id, group)

    return group
  }

  for (const { category, role, itemName } of pending) {
    const slot = { category, role }

    for (const { tier } of savedEntriesOf(groups, slot, itemName)) {
      const group = groupOf({ category, role, tier })
      group.items = group.items.filter(
        (item) => !isSameLabItem(slot.category, item.itemName, itemName)
      )
    }
  }

  for (const { category, role, itemName, tier, cost: changedCost } of pending) {
    if (tier === null) {
      continue
    }

    const saved = savedEntryOf(groups, { category, role }, itemName)
    const cost = saved !== null ? saved.cost : changedCost
    const group = groupOf({ category, role, tier })
    group.items = [...group.items, { itemName, cost }]
  }

  return [...touched.values()]
}
