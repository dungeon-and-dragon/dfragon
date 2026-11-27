import type {
  LabCurrencyIcon,
  LabItemCard,
  LabItemPriceCost,
  LabItemPriceDetail,
  LabItemPriceRow
} from '@dfragon/database'
import {
  LAB_ITEM_CATEGORIES,
  LAB_ITEM_TIERS,
  type LabItemCategory,
  type LabItemRole,
  type LabItemTier,
  labItemRolesOf
} from '@dfragon/lib/lab-items'
import type { ItemCard } from '#domain/item-detail/index.js'
import type { LabItemRepository } from './repository.js'

export interface LabItemCurrencyCost {
  currencyName: string
  description: string | null
  count: number
  iconPath: string
}

// 아이템 상세 응답과 같은 이름과 카드 모양이라 웹이 같은 tooltip으로 그린다.
export interface LabItemTooltip {
  typeDetail: string | null
  availableLevel: number | null
  fame: number | null
  card: ItemCard | null
}

// itemId는 Neople 아이템이고, itemRarity, iconPath, description은 소유자가 넣은 값을 Neople 값보다 먼저 쓴 결과다.
// tooltip은 소유자가 아이템 상세를 넣은 아이템에만 있다.
export interface LabItemPrice {
  itemName: string
  itemId: string | null
  itemRarity: string | null
  iconPath: string | null
  description: string | null
  tooltip: LabItemTooltip | null
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
  readCurrencyIcon: async () => null,
  readItemIcon: async () => null
}

// 아이콘을 바꾸면 주소의 v가 바뀌어, 아이콘 응답을 오래 캐시해도 바꾼 아이콘이 보인다.
function currencyIconPath(currencyId: number, updatedAt: Date): string {
  return `/lab/currencies/${currencyId}/icon?v=${updatedAt.getTime()}`
}

// 아이템 이름에 쉼표, 괄호, 공백이 들어가 경로 대신 query로 넘긴다.
function itemIconPath(itemName: string, updatedAt: Date): string {
  const query = new URLSearchParams({ itemName, v: String(updatedAt.getTime()) })

  return `/lab/item-icon?${query}`
}

function uploadedIconPath(itemName: string, { iconUpdatedAt }: LabItemPriceDetail): string | null {
  if (iconUpdatedAt === null) {
    return null
  }

  return itemIconPath(itemName, iconUpdatedAt)
}

type ItemLook = Pick<LabItemPrice, 'itemRarity' | 'iconPath' | 'description' | 'tooltip'>

// 소유자는 버프 스킬 줄을 넣지 않는다.
function toItemCard({ slots, enchants }: LabItemCard): ItemCard {
  const stages = enchants.map(({ upgrade, status }) => ({ upgrade, status, reinforceSkill: [] }))

  return { slots, enchants: stages }
}

function toTooltip({
  itemTypeDetail,
  availableLevel,
  fame,
  card
}: LabItemPriceDetail): LabItemTooltip {
  const itemCard = card !== null ? toItemCard(card) : null

  return { typeDetail: itemTypeDetail, availableLevel, fame, card: itemCard }
}

function lookOf(
  itemName: string,
  neopleRarity: string | null,
  detail: LabItemPriceDetail | null
): ItemLook {
  if (detail === null) {
    return { itemRarity: neopleRarity, iconPath: null, description: null, tooltip: null }
  }

  const itemRarity = detail.itemRarity ?? neopleRarity
  const iconPath = uploadedIconPath(itemName, detail)
  const tooltip = toTooltip(detail)

  return { itemRarity, iconPath, description: detail.description, tooltip }
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
  cost,
  detail
}: LabItemPriceRow): LabItemPrice {
  const look = lookOf(itemName, itemRarity, detail)

  if (cost !== null) {
    const currencyCost = toCurrencyCost(cost)

    return { itemName, itemId, ...look, unitPrice: null, checkedAt, cost: currencyCost }
  }

  return { itemName, itemId, ...look, unitPrice, checkedAt, cost: null }
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

  readItemIcon(itemName: string): Promise<LabCurrencyIcon | null> {
    return this.repository.readItemIcon(itemName)
  }
}
