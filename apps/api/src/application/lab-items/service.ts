import type { LabItemPriceRow } from '@dfragon/database'
import {
  LAB_ITEM_CATEGORIES,
  LAB_ITEM_TIERS,
  type LabItemCategory,
  type LabItemRole,
  type LabItemTier,
  labItemRolesOf
} from '@dfragon/lib/lab-items'
import type { LabItemRepository } from './repository.js'

export interface LabItemPrice {
  itemName: string
  itemId: string | null
  itemRarity: string | null
  unitPrice: number | null
  checkedAt: Date | null
}

export interface LabItemGroupPrices {
  category: LabItemCategory
  role: LabItemRole
  tier: LabItemTier
  items: LabItemPrice[]
}

export interface LabItems {
  groups: LabItemGroupPrices[]
}

export const emptyLabItemRepository: LabItemRepository = {
  readLabItemPrices: async () => []
}

function comparePrices(left: LabItemPrice, right: LabItemPrice): number {
  if (left.unitPrice !== null && right.unitPrice !== null && left.unitPrice !== right.unitPrice) {
    return left.unitPrice - right.unitPrice
  }

  if (left.unitPrice !== null && right.unitPrice === null) {
    return -1
  }

  if (left.unitPrice === null && right.unitPrice !== null) {
    return 1
  }

  return left.itemName.localeCompare(right.itemName, 'ko')
}

function toPrice({ itemName, itemId, itemRarity, unitPrice, checkedAt }: LabItemPriceRow) {
  return { itemName, itemId, itemRarity, unitPrice, checkedAt }
}

export class LabItemService {
  constructor(private readonly repository: LabItemRepository) {}

  async get(): Promise<LabItems> {
    const rows = await this.repository.readLabItemPrices()
    const keys = LAB_ITEM_CATEGORIES.flatMap((category) =>
      labItemRolesOf(category).flatMap((role) =>
        LAB_ITEM_TIERS.map((tier) => ({ category, role, tier }))
      )
    )
    const groups = keys.map(({ category, role, tier }) => {
      const items = rows
        .filter((row) => row.category === category && row.role === role && row.tier === tier)
        .map(toPrice)
        .sort(comparePrices)

      return { category, role, tier, items }
    })
    const filled = groups.filter(({ items }) => items.length > 0)

    return { groups: filled }
  }
}
