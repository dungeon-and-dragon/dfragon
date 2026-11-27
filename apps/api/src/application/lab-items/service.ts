import type { CatalogDetail } from '@dfragon/server-core/domain/character-catalog/index.js'
import type {
  LabCurrencyIcon,
  LabItemCard,
  LabItemPriceCost,
  LabItemPriceDetail,
  LabItemPriceRow
} from '@dfragon/database'
import {
  isEnchantCategory,
  LAB_ITEM_CATEGORIES,
  LAB_ITEM_TIERS,
  type LabItemCategory,
  type LabItemRole,
  type LabItemTier,
  labItemRolesOf
} from '@dfragon/lib/lab-items'
import { CATALOG_LIMITS } from '@dfragon/server-core/domain/character-catalog/index.js'
import { type ItemCard, projectItemDetail } from '#domain/item-detail/index.js'
import type { LoadItemDetails } from './ports.js'
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
// fame은 마법부여 카드의 가장 높은 단계 모험가 명성이고, 소유자가 넣은 명성을 Neople 카드 값보다 먼저 쓴다.
export interface LabItemPrice {
  itemName: string
  itemId: string | null
  itemRarity: string | null
  iconPath: string | null
  description: string | null
  tooltip: LabItemTooltip | null
  fame: number | null
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

const FAME_STATUS = '모험가 명성'
const ENCHANT_CATEGORIES: ReadonlySet<string> = new Set(
  LAB_ITEM_CATEGORIES.filter(isEnchantCategory)
)

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

// 경매장 가격, 재화 비용, 가격 없음 순서다. 재화 비용은 경매장 가격과 견줄 수 없어 경매장 가격 뒤에 둔다.
function priceRank({ unitPrice, cost }: LabItemPrice): number {
  if (unitPrice !== null) {
    return 0
  }

  if (cost !== null) {
    return 1
  }

  return 2
}

function compareNullableDescending(left: number | null, right: number | null): number {
  if (left === right) {
    return 0
  }

  if (left === null) {
    return 1
  }

  if (right === null) {
    return -1
  }

  return right - left
}

// 명성이 높은 순, 같은 명성 안에서는 경매장 가격이 낮은 순이고 명성이나 가격이 없는 아이템은 뒤에 둔다.
function comparePrices(left: LabItemPrice, right: LabItemPrice): number {
  const fameOrder = compareNullableDescending(left.fame, right.fame)

  if (fameOrder !== 0) {
    return fameOrder
  }

  const rankOrder = priceRank(left) - priceRank(right)

  if (rankOrder !== 0) {
    return rankOrder
  }

  if (left.unitPrice !== null && right.unitPrice !== null && left.unitPrice !== right.unitPrice) {
    return left.unitPrice - right.unitPrice
  }

  return left.itemName.localeCompare(right.itemName, 'ko')
}

function cardFame(itemId: string, detail: CatalogDetail): number | null {
  if (detail.data === null) {
    return null
  }

  const item = projectItemDetail(itemId, detail.data)
  const fame = item?.card?.enchants.at(-1)?.status.find(({ name }) => name === FAME_STATUS)
  const value = Number(fame?.value)

  if (!Number.isInteger(value) || value <= 0) {
    return null
  }

  return value
}

function chunks<T>(values: readonly T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
    values.slice(index * size, (index + 1) * size)
  )
}

// 재화 비용을 붙인 아이템은 경매장 가격을 내지 않는다.
function toPrice(
  { itemName, itemId, itemRarity, unitPrice, checkedAt, cost, detail }: LabItemPriceRow,
  fame: number | null
): LabItemPrice {
  const look = lookOf(itemName, itemRarity, detail)

  if (cost !== null) {
    const currencyCost = toCurrencyCost(cost)

    return { itemName, itemId, ...look, fame, unitPrice: null, checkedAt, cost: currencyCost }
  }

  return { itemName, itemId, ...look, fame, unitPrice, checkedAt, cost: null }
}

function needsNeopleFame(row: LabItemPriceRow): row is LabItemPriceRow & { itemId: string } {
  return row.itemId !== null && ENCHANT_CATEGORIES.has(row.category) && row.detail?.fame == null
}

function fameOf(
  row: LabItemPriceRow,
  neopleFames: ReadonlyMap<string, number | null>
): number | null {
  if (!ENCHANT_CATEGORIES.has(row.category)) {
    return null
  }

  const ownerFame = row.detail?.fame

  if (ownerFame != null) {
    return ownerFame
  }

  if (row.itemId === null) {
    return null
  }

  const neopleFame = neopleFames.get(row.itemId)

  if (neopleFame === undefined) {
    return null
  }

  return neopleFame
}

export class LabItemService {
  constructor(
    private readonly repository: LabItemRepository,
    private readonly loadItemDetails: LoadItemDetails
  ) {}

  private async neopleFames(
    rows: readonly LabItemPriceRow[],
    signal: AbortSignal
  ): Promise<Map<string, number | null>> {
    const itemIds = [...new Set(rows.filter(needsNeopleFame).map(({ itemId }) => itemId))]
    const loaded = await Promise.all(
      chunks(itemIds, CATALOG_LIMITS.maximumReferencesPerLoad).map((ids) =>
        this.loadItemDetails(ids, signal)
      )
    )
    const details = loaded.flatMap((map) => [...map])

    return new Map(details.map(([itemId, detail]) => [itemId, cardFame(itemId, detail)]))
  }

  async get(signal: AbortSignal): Promise<LabItems> {
    const rows = await this.repository.readLabItemPrices()
    const fames = await this.neopleFames(rows, signal)
    const toItem = (row: LabItemPriceRow) => toPrice(row, fameOf(row, fames))
    const keys = LAB_ITEM_CATEGORIES.flatMap((category) =>
      labItemRolesOf(category).flatMap((role) =>
        LAB_ITEM_TIERS.map((tier) => ({ category, role, tier }))
      )
    )
    const groups = keys.map(({ category, role, tier }) => {
      const items = rows
        .filter((row) => row.category === category && row.role === role && row.tier === tier)
        .map(toItem)
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
