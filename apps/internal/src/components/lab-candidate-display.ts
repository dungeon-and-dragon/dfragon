import type { LabCandidate } from '#ops-api/ops-schemas'
import { CATEGORY_NAMES } from './lab-item-names'

export const MISSING_VALUE = '-'

const RARITY_TEXT_CLASSES: Readonly<Record<string, string>> = {
  커먼: 'text-rarity-common',
  언커먼: 'text-rarity-uncommon',
  레어: 'text-rarity-rare',
  유니크: 'text-rarity-unique',
  레전더리: 'text-rarity-legendary',
  에픽: 'text-rarity-epic',
  크로니클: 'text-rarity-chronicle',
  태초: 'text-rarity-primordial',
  신화: 'text-rarity-mythic'
}

export function rarityClassesOf(rarity: string | null): { icon: string; name: string } {
  const solid = rarity !== null ? RARITY_TEXT_CLASSES[rarity] : undefined

  if (solid === undefined) {
    return { icon: 'text-line-strong', name: 'text-fg' }
  }

  return { icon: solid, name: solid }
}

export function detailOf({ kind, itemRarity, categories }: LabCandidate): string {
  const parts = itemRarity !== null ? [itemRarity] : []

  if (kind === 'ENCHANT') {
    parts.push(categories.map((category) => CATEGORY_NAMES[category]).join(', '))
  }

  return parts.join(' · ')
}

export function optionsOf({ card, options }: LabCandidate): string {
  const lines = card?.enchants.at(-1)?.status ?? options

  return lines.map(({ name, value }) => `${name} ${value}`).join(', ')
}

export type PriceChange = { direction: 'up' | 'down'; percent: string }

export function priceChangeOf({ unitPrice, previousPrice }: LabCandidate): PriceChange | null {
  const previous = previousPrice?.unitPrice ?? null

  if (unitPrice === null || previous === null || unitPrice === previous) {
    return null
  }

  const ratio = ((unitPrice - previous) / previous) * 100
  const direction = ratio > 0 ? 'up' : 'down'
  const percent = `${Math.abs(ratio).toFixed(1)}%`

  return { direction, percent }
}

export type SortKey = 'name' | 'fame' | 'price' | 'wear'

export type Sort = { key: SortKey; direction: 'asc' | 'desc' }

export const DEFAULT_SORT: Sort = { key: 'fame', direction: 'desc' }

const NUMBER_OF: Readonly<
  Record<Exclude<SortKey, 'name'>, (candidate: LabCandidate) => number | null>
> = {
  fame: ({ fame }) => fame,
  price: ({ unitPrice }) => unitPrice,
  wear: ({ wearCount }) => wearCount
}

export function nextSort(current: Sort, key: SortKey): Sort {
  if (current.key === key) {
    const direction = current.direction === 'asc' ? 'desc' : 'asc'

    return { key, direction }
  }

  const direction = key === 'name' ? 'asc' : 'desc'

  return { key, direction }
}

// 값이 없는 줄은 정렬 방향과 상관없이 맨 뒤에 둔다.
export function sortCandidates(candidates: readonly LabCandidate[], sort: Sort): LabCandidate[] {
  const sign = sort.direction === 'asc' ? 1 : -1

  if (sort.key === 'name') {
    return [...candidates].sort((left, right) => sign * left.itemName.localeCompare(right.itemName))
  }

  const numberOf = NUMBER_OF[sort.key]

  return [...candidates].sort((left, right) => {
    const leftValue = numberOf(left)
    const rightValue = numberOf(right)

    if (leftValue === null || rightValue === null) {
      return Number(leftValue === null) - Number(rightValue === null)
    }

    return sign * (leftValue - rightValue)
  })
}
