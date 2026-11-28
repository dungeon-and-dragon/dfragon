import { isEnchantCategory, type LabItemCategory } from '@dfragon/lib/lab-items'
import type { EnchantRole } from '#entities/character'
import type { LabItem, LabItemGroup } from './api/useLabItems'

export type { EnchantRole }

export type LabItemRow = Readonly<{ item: LabItem; others: readonly LabItem[] }>

export type LabTierRows = Readonly<{ tier: LabItemGroup['tier']; items: readonly LabItemRow[] }>

export type LabCategoryRows = Readonly<{
  category: LabItemCategory
  tiers: readonly LabTierRows[]
}>

// 같은 성능 아이템은 구매 방법도 같아 경매장 최저가끼리, 또는 같은 재화의 개수끼리 비교한다.
function priceOf({ cost, unitPrice }: LabItem): number | null {
  if (cost !== null) {
    return cost.count
  }

  return unitPrice
}

function isCheaper(item: LabItem, than: LabItem): boolean {
  const price = priceOf(item)
  const current = priceOf(than)

  return price !== null && (current === null || price < current)
}

function itemRowOf(sameItems: readonly LabItem[]): LabItemRow {
  const item = sameItems.reduce((cheapest, candidate) => {
    if (isCheaper(candidate, cheapest)) {
      return candidate
    }

    return cheapest
  })

  const others = sameItems.filter((candidate) => candidate !== item)

  return { item, others }
}

function itemRowsOf(items: readonly LabItem[]): LabItemRow[] {
  const sameItemsByKey = new Map<string, LabItem[]>()
  const rows: LabItem[][] = []

  for (const item of items) {
    const key = item.performanceKey
    const sameItems = key !== null ? sameItemsByKey.get(key) : undefined

    if (sameItems !== undefined) {
      sameItems.push(item)
      continue
    }

    const row = [item]
    rows.push(row)

    if (key !== null) {
      sameItemsByKey.set(key, row)
    }
  }

  return rows.map(itemRowOf)
}

// 응답이 묶음을 부위, 등급 순으로 주므로 순서는 그대로 두고, 같은 부위의 이어진 묶음만 한 칸으로 모은다.
function categoryRowsOf(groups: readonly LabItemGroup[]): LabCategoryRows[] {
  const rows: { category: LabItemCategory; tiers: LabTierRows[] }[] = []

  for (const { category, tier, items } of groups) {
    if (items.length === 0) {
      continue
    }

    const last = rows.at(-1)
    const itemRows = itemRowsOf(items)
    const tierRows = { tier, items: itemRows }

    if (last?.category === category) {
      last.tiers.push(tierRows)
    } else {
      rows.push({ category, tiers: [tierRows] })
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

// 플래티넘 표의 이름과 tooltip은 일반 표와 같은 기본 이름 줄의 값이고, 가격만 플래티넘 변형의 최저가다.
function platinumItemOf({ platinum, ...item }: LabItem): LabItem[] {
  if (platinum === null) {
    return []
  }

  const { unitPrice, checkedAt } = platinum

  return [{ ...item, unitPrice, checkedAt, cost: null, platinum: null }]
}

export function platinumRowsOf(groups: readonly LabItemGroup[]): LabCategoryRows[] {
  const platinumGroups = groups.map((group) => {
    const items = group.items.flatMap(platinumItemOf)

    return { ...group, items }
  })

  return categoryRowsOf(platinumGroups)
}

export function hasLabItems(groups: readonly LabItemGroup[]): boolean {
  return groups.some((group) => group.items.length > 0)
}

export function lastCheckedAtOf(groups: readonly LabItemGroup[]): string | null {
  let last: string | null = null

  for (const group of groups) {
    for (const { checkedAt, platinum } of group.items) {
      for (const at of [checkedAt, platinum?.checkedAt ?? null]) {
        if (at !== null && (last === null || Date.parse(at) > Date.parse(last))) {
          last = at
        }
      }
    }
  }

  return last
}
