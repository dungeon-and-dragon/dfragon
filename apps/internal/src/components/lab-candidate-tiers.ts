import {
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

type SavedEntry = { tier: LabItemTier; cost: LabItemCost | null }

export function tierChangeIdOf({ category, role }: TierSlot, itemName: string): string {
  return `${category}:${role}:${itemName}`
}

function savedEntryOf(
  groups: readonly LabItemGroup[],
  { category, role }: TierSlot,
  itemName: string
): SavedEntry | null {
  for (const group of groups) {
    const tier = LAB_ITEM_TIERS.find((candidate) => candidate === group.tier)

    if (group.category !== category || group.role !== role || tier === undefined) {
      continue
    }

    const item = group.items.find((candidate) => candidate.itemName === itemName)

    if (item !== undefined) {
      return { tier, cost: item.cost }
    }
  }

  return null
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

// 일부 묶음만 저장된 뒤 다시 읽으면 이미 저장된 변경은 저장할 것에서 빠진다.
export function pendingTierChanges(
  groups: readonly LabItemGroup[],
  changes: TierChanges
): TierChange[] {
  return [...changes.values()].filter(
    (change) => change.tier !== savedTierOf(groups, change, change.itemName)
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
    const saved = savedEntryOf(groups, { category, role }, itemName)

    if (saved !== null) {
      const group = groupOf({ category, role, tier: saved.tier })
      group.items = group.items.filter((item) => item.itemName !== itemName)
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
