import type { LabCurrencyIcon, LabItemPriceCost, LabItemPriceRow } from '@dfragon/database'
import {
  LAB_ITEM_CATEGORIES,
  LAB_ITEM_TIERS,
  type LabItemCategory,
  type LabItemRole,
  type LabItemTier,
  labItemRolesOf
} from '@dfragon/lib/lab-items'
import type { LabItemRepository } from './repository.js'

export interface LabItemCurrencyCost {
  currencyName: string
  description: string | null
  count: number
  iconPath: string
}

export interface LabItemPrice {
  itemName: string
  itemId: string | null
  itemRarity: string | null
  unitPrice: number | null
  checkedAt: Date | null
  cost: LabItemCurrencyCost | null
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
  readLabItemPrices: async () => [],
  readCurrencyIcon: async () => null
}

// 아이콘을 바꾸면 주소의 v가 바뀌어, 아이콘 응답을 오래 캐시해도 바꾼 아이콘이 보인다.
function currencyIconPath(currencyId: number, updatedAt: Date): string {
  return `/lab/currencies/${currencyId}/icon?v=${updatedAt.getTime()}`
}

function toCurrencyCost({
  currencyId,
  currencyName,
  currencyDescription,
  currencyUpdatedAt,
  count
}: LabItemPriceCost): LabItemCurrencyCost {
  const iconPath = currencyIconPath(currencyId, currencyUpdatedAt)

  return { currencyName, description: currencyDescription, count, iconPath }
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

// 재화 비용을 붙인 아이템은 경매장 가격을 내지 않는다.
function toPrice({
  itemName,
  itemId,
  itemRarity,
  unitPrice,
  checkedAt,
  cost
}: LabItemPriceRow): LabItemPrice {
  if (cost !== null) {
    const currencyCost = toCurrencyCost(cost)

    return { itemName, itemId, itemRarity, unitPrice: null, checkedAt, cost: currencyCost }
  }

  return { itemName, itemId, itemRarity, unitPrice, checkedAt, cost: null }
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

  readCurrencyIcon(id: number): Promise<LabCurrencyIcon | null> {
    return this.repository.readCurrencyIcon(id)
  }
}
