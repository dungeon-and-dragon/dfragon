import { isEnchantCategory, type LabItemCategory } from '@dfragon/lib/lab-items'
import type { LabItem, LabItemGroup } from './api/useLabItems'

export type EnchantRole = 'dealer' | 'buffer'

export type LabTierRows = Readonly<{ tier: LabItemGroup['tier']; items: readonly LabItem[] }>

export type LabCategoryRows = Readonly<{
  category: LabItemCategory
  tiers: readonly LabTierRows[]
}>

// 응답이 묶음을 부위, 등급 순으로 주므로 순서는 그대로 두고, 같은 부위의 이어진 묶음만 한 칸으로 모은다.
function categoryRowsOf(groups: readonly LabItemGroup[]): LabCategoryRows[] {
  const rows: { category: LabItemCategory; tiers: LabTierRows[] }[] = []

  for (const { category, tier, items } of groups) {
    if (items.length === 0) {
      continue
    }

    const last = rows.at(-1)

    if (last?.category === category) {
      last.tiers.push({ tier, items })
    } else {
      rows.push({ category, tiers: [{ tier, items }] })
    }
  }

  return rows
}

export function enchantRowsOf(
  groups: readonly LabItemGroup[],
  role: EnchantRole
): LabCategoryRows[] {
  return categoryRowsOf(
    groups.filter((group) => isEnchantCategory(group.category) && group.role === role)
  )
}

export function accessoryRowsOf(groups: readonly LabItemGroup[]): LabCategoryRows[] {
  return categoryRowsOf(groups.filter((group) => !isEnchantCategory(group.category)))
}

export function hasLabItems(groups: readonly LabItemGroup[]): boolean {
  return groups.some((group) => group.items.length > 0)
}

export function lastCheckedAtOf(groups: readonly LabItemGroup[]): string | null {
  let last: string | null = null

  for (const group of groups) {
    for (const { checkedAt } of group.items) {
      if (checkedAt !== null && (last === null || Date.parse(checkedAt) > Date.parse(last))) {
        last = checkedAt
      }
    }
  }

  return last
}
