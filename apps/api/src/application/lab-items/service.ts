import { createHash } from 'node:crypto'
import { LRUCache } from 'lru-cache'
import type { CatalogDetail } from '@dfragon/server-core/domain/character-catalog/index.js'
import type {
  LabCurrencyIcon,
  LabItemCard,
  LabItemPriceCandidate,
  LabItemPriceCost,
  LabItemPriceDetail,
  LabItemPriceRow,
  LabItemStatusLine
} from '@dfragon/database'
import {
  isEnchantCategory,
  LAB_ITEM_CATEGORIES,
  LAB_ITEM_TIERS,
  type LabItemCategory,
  type LabItemRole,
  type LabItemTier,
  labItemRolesOf,
  SLOT_ITEM_CATEGORIES,
  SLOT_ITEM_LAB_CATEGORIES,
  type SlotItemCategory
} from '@dfragon/lib/lab-items'
import { CATALOG_LIMITS } from '@dfragon/server-core/domain/character-catalog/index.js'
import type { EnchantEntry } from '@dfragon/lib/enchant-grades'
import { type ItemCard, projectItemDetail } from '#domain/item-detail/index.js'
import {
  type LabEnchantSlot,
  type LabEnchantSource,
  type LabSlotItemGroup,
  type LabSlotItemSource,
  labEnchantOptions,
  labSlotItemOptions,
  neopleCardEntry,
  ownerCardEntry
} from '#domain/lab-enchant-options/index.js'
import type { FindGameItem, FoundGameItem, LoadItemDetails } from './ports.js'
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
  performanceKey: string | null
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

export type LabEnchantCard = Pick<
  LabItemPrice,
  'itemName' | 'itemId' | 'itemRarity' | 'iconPath' | 'unitPrice' | 'cost'
>

export interface LabEnchantOptions {
  slots: LabEnchantSlot<LabEnchantCard>[]
}

/** gameItemName은 엔진이 아는 게임 아이템 이름이라 오라 상자, 크리쳐 알이면 itemName과 다르다. */
export type LabSlotItemCard = LabEnchantCard & { gameItemName: string }

export interface LabSlotItemOptions {
  slotItems: LabSlotItemGroup<LabSlotItemCard>[]
}

const FAME_STATUS = '모험가 명성'
const ENCHANT_ROLES = ['dealer', 'buffer'] as const
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

type ItemLook = Pick<LabItemPrice, 'itemRarity' | 'iconPath' | 'description' | 'tooltip'>

// 저장한 카드는 버프 스킬 줄을 담지 않는다.
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
  detail: LabItemPriceDetail | null,
  candidate: LabItemPriceDetail | null
): ItemLook {
  const itemRarity = detail?.itemRarity ?? candidate?.itemRarity ?? neopleRarity
  const iconUpdatedAt = detail?.iconUpdatedAt ?? candidate?.iconUpdatedAt ?? null
  const iconPath = iconUpdatedAt !== null ? itemIconPath(itemName, iconUpdatedAt) : null
  const description = detail?.description ?? candidate?.description ?? null
  const tooltipDetail = detail ?? candidate
  const tooltip = tooltipDetail !== null ? toTooltip(tooltipDetail) : null

  return { itemRarity, iconPath, description, tooltip }
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

function neopleCard(itemId: string, detail: CatalogDetail | undefined): ItemCard | null {
  if (detail === undefined || detail.data === null) {
    return null
  }

  const item = projectItemDetail(itemId, detail.data)

  if (item === null) {
    return null
  }

  return item.card
}

function cardFame(itemId: string, detail: CatalogDetail): number | null {
  const card = neopleCard(itemId, detail)
  const fame = card?.enchants.at(-1)?.status.find(({ name }) => name === FAME_STATUS)
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
  fame: number | null,
  candidate: LabItemPriceCandidate | null
): LabItemPrice {
  const look = lookOf(itemName, itemRarity, detail, candidate)
  const performanceKey = performanceKeyOf(detail, candidate, fame, cost)

  if (cost !== null) {
    const currencyCost = toCurrencyCost(cost)

    return {
      itemName,
      itemId,
      ...look,
      fame,
      unitPrice: null,
      checkedAt,
      cost: currencyCost,
      performanceKey
    }
  }

  return {
    itemName,
    itemId,
    ...look,
    fame,
    unitPrice,
    checkedAt,
    cost: null,
    performanceKey
  }
}

function enchantEntryOf(
  row: LabItemPriceRow,
  details: ReadonlyMap<string, CatalogDetail>
): EnchantEntry | null {
  if (row.itemId !== null) {
    const card = neopleCard(row.itemId, details.get(row.itemId))

    if (card === null) {
      return null
    }

    return neopleCardEntry(card)
  }

  const ownerCard = row.detail?.card

  if (ownerCard == null) {
    return null
  }

  return ownerCardEntry(ownerCard)
}

function toEnchantCard(row: LabItemPriceRow): LabEnchantCard {
  const { itemName, itemId, itemRarity, iconPath, unitPrice, cost } = toPrice(row, null, null)

  return { itemName, itemId, itemRarity, iconPath, unitPrice, cost }
}

function isEnchantRow(row: LabItemPriceRow): boolean {
  return ENCHANT_CATEGORIES.has(row.category)
}

function slotItemCategoryOf(row: LabItemPriceRow): SlotItemCategory | null {
  const category = SLOT_ITEM_CATEGORIES.find(
    (candidate) => SLOT_ITEM_LAB_CATEGORIES[candidate] === row.category
  )

  if (category === undefined) {
    return null
  }

  return category
}

// 오라 상자, 크리쳐 알은 이은 후보가 엔진이 아는 게임 아이템 이름이다.
function gameItemNameOf({ candidate, itemName }: LabItemPriceRow): string {
  if (candidate === null) {
    return itemName
  }

  return candidate.itemName
}

function enchantSourceOf(
  row: LabItemPriceRow,
  details: ReadonlyMap<string, CatalogDetail>
): LabEnchantSource<LabEnchantCard>[] {
  const category = LAB_ITEM_CATEGORIES.find((candidate) => candidate === row.category)
  const role = ENCHANT_ROLES.find((candidate) => candidate === row.role)
  const tier = LAB_ITEM_TIERS.find((candidate) => candidate === row.tier)

  if (category === undefined || !isEnchantCategory(category) || role === undefined) {
    return []
  }

  const entry = enchantEntryOf(row, details)

  if (entry === null || tier === undefined) {
    return []
  }

  const card = toEnchantCard(row)

  return [{ slotId: category, role, tier, entry, card }]
}

function digestOptionKey(key: string): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 16)
}

type PerformanceOptions = { slots: string[]; options: string[] }

const NO_PERFORMANCE_OPTIONS: PerformanceOptions = { slots: [], options: [] }

function statusLinesOf(status: readonly LabItemStatusLine[]): string[] {
  return status.map(({ name, value }) => `${name}:${value}`)
}

// 마법부여 카드는 낮은 단계 옵션이 달라도 가장 높은 강화 단계의 옵션이 같으면 같은 성능이다.
function cardPerformanceOf({ slots, enchants }: LabItemCard): PerformanceOptions {
  const top = enchants.reduce<LabItemCard['enchants'][number] | null>(
    (best, enchant) => (best === null || enchant.upgrade > best.upgrade ? enchant : best),
    null
  )
  const options = statusLinesOf(top?.status ?? [])

  return { slots, options }
}

function performanceOptionsOf(
  detail: LabItemPriceDetail | null,
  candidate: LabItemPriceCandidate | null
): PerformanceOptions {
  if (detail?.card != null) {
    return cardPerformanceOf(detail.card)
  }

  if (candidate === null) {
    return NO_PERFORMANCE_OPTIONS
  }

  if (candidate.card !== null) {
    return cardPerformanceOf(candidate.card)
  }

  const options = statusLinesOf(candidate.options)

  return { slots: [], options }
}

function sorted(values: readonly string[]): string[] {
  return [...values].sort()
}

// 같은 묶음 안에서 옵션 줄, 버프 줄, 명성, 구매 방법이 모두 같은 아이템끼리 같은 키다.
function performanceKeyOf(
  detail: LabItemPriceDetail | null,
  candidate: LabItemPriceCandidate | null,
  fame: number | null,
  cost: LabItemPriceCost | null
): string | null {
  const { slots, options } = performanceOptionsOf(detail, candidate)
  const buffLines = candidate?.buffLines ?? []

  if (options.length === 0) {
    return null
  }

  const currencyId = cost?.currencyId ?? null
  const sortedSlots = sorted(slots)
  const sortedOptions = sorted(options)
  const sortedBuffLines = sorted(buffLines)
  const key = JSON.stringify({
    slots: sortedSlots,
    options: sortedOptions,
    buffLines: sortedBuffLines,
    fame,
    currencyId
  })

  return digestOptionKey(key)
}

function needsNeopleFame(row: LabItemPriceRow): row is LabItemPriceRow & { itemId: string } {
  return row.itemId !== null && isEnchantRow(row) && row.detail?.fame == null
}

function fameOf(
  row: LabItemPriceRow,
  neopleFames: ReadonlyMap<string, number | null>
): number | null {
  const ownerFame = row.detail?.fame

  if (ownerFame != null) {
    return ownerFame
  }

  const candidateFame = row.candidate?.fame ?? null

  if (isEnchantRow(row) && row.itemId !== null) {
    const fame = neopleFames.get(row.itemId) ?? candidateFame

    return fame
  }

  return candidateFame
}

type IconRead = () => Promise<LabCurrencyIcon | null>

// 운영 아이콘은 2KB 안쪽이라 8MB면 표의 아이콘과 후보 아이콘이 모두 남는다.
const ICON_CACHE_MAX_BYTES = 8 * 1024 * 1024

export class LabItemService {
  // 표를 열면 아이콘 수십 개가 한꺼번에 와 DB 연결을 기다리므로, 주소의 v까지 key로 두어 바꾼 아이콘은 새로 읽는다.
  // fetch는 같은 key를 동시에 읽는 요청을 하나로 묶고, 없는 아이콘(undefined)은 기억하지 않는다.
  private readonly icons = new LRUCache<string, LabCurrencyIcon, IconRead>({
    maxSize: ICON_CACHE_MAX_BYTES,
    sizeCalculation: (icon) => Math.max(icon.bytes.byteLength, 1),
    fetchMethod: async (_key, _stale, { context }) => {
      const icon = await context()

      if (icon === null) {
        return undefined
      }

      return icon
    }
  })

  // 게임 아이템 이름의 Neople id는 바뀌지 않아 찾지 못한 결과까지 process 동안 둔다. 검색 요청이 실패한 이름만 다음 요청이 다시 찾는다.
  private readonly gameItems = new Map<string, Promise<FoundGameItem | null>>()

  constructor(
    private readonly repository: LabItemRepository,
    private readonly loadItemDetails: LoadItemDetails,
    private readonly findGameItem: FindGameItem
  ) {}

  private gameItem(itemName: string): Promise<FoundGameItem | null> {
    const known = this.gameItems.get(itemName)

    if (known !== undefined) {
      return known
    }

    const found = this.findGameItem(itemName).catch(() => {
      this.gameItems.delete(itemName)

      return null
    })

    this.gameItems.set(itemName, found)

    return found
  }

  private async slotItemSource(
    row: LabItemPriceRow,
    category: SlotItemCategory
  ): Promise<LabSlotItemSource<LabSlotItemCard> | null> {
    const tier = LAB_ITEM_TIERS.find((candidate) => candidate === row.tier)

    if (tier === undefined) {
      return null
    }

    const fame = row.detail?.fame ?? row.candidate?.fame ?? null
    const price = toPrice(row, fame, row.candidate)
    const itemName = gameItemNameOf(row)
    const found = await this.gameItem(itemName)
    const item = found !== null ? { itemName, ...found } : null
    const itemId = found?.itemId ?? null
    const card: LabSlotItemCard = {
      itemName: price.itemName,
      gameItemName: itemName,
      itemId,
      itemRarity: price.itemRarity,
      iconPath: price.iconPath,
      unitPrice: price.unitPrice,
      cost: price.cost
    }

    return { category, tier, fame, performanceKey: price.performanceKey, card, item }
  }

  /** 이름으로 Neople 아이템을 찾지 못한 항목은 다른 항목과 묶인 카드로만 보이고 혼자서는 선택지가 되지 않는다. */
  private async slotItemOptionsOf(rows: readonly LabItemPriceRow[]): Promise<LabSlotItemOptions> {
    const sources = await Promise.all(
      rows.map((row) => {
        const category = slotItemCategoryOf(row)

        if (category === null) {
          return null
        }

        return this.slotItemSource(row, category)
      })
    )

    const slotItemSources = sources.filter((source) => source !== null)
    const slotItems = labSlotItemOptions(SLOT_ITEM_CATEGORIES, slotItemSources, digestOptionKey)

    return { slotItems }
  }

  private async itemDetails(
    itemIds: readonly string[],
    signal: AbortSignal
  ): Promise<Map<string, CatalogDetail>> {
    const unique = [...new Set(itemIds)]
    const loaded = await Promise.all(
      chunks(unique, CATALOG_LIMITS.maximumReferencesPerLoad).map((ids) =>
        this.loadItemDetails(ids, signal)
      )
    )

    return new Map(loaded.flatMap((map) => [...map]))
  }

  private async neopleFames(
    rows: readonly LabItemPriceRow[],
    signal: AbortSignal
  ): Promise<Map<string, number | null>> {
    const itemIds = rows.filter(needsNeopleFame).map(({ itemId }) => itemId)
    const details = await this.itemDetails(itemIds, signal)

    return new Map([...details].map(([itemId, detail]) => [itemId, cardFame(itemId, detail)]))
  }

  /** 아이템 상세를 받지 못한 카드는 빼고 나머지로 선택지를 만든다. */
  private async enchantOptionsOf(
    allRows: readonly LabItemPriceRow[],
    signal: AbortSignal
  ): Promise<LabEnchantOptions> {
    const rows = allRows.filter(isEnchantRow)
    const itemIds = rows.flatMap(({ itemId }) => (itemId !== null ? [itemId] : []))
    const details = await this.itemDetails(itemIds, signal)
    const sources = rows.flatMap((row) => enchantSourceOf(row, details))
    const slots = labEnchantOptions(sources, digestOptionKey)

    return { slots }
  }

  async enchantOptions(signal: AbortSignal): Promise<LabEnchantOptions> {
    const rows = await this.repository.readLabItemPrices()

    return await this.enchantOptionsOf(rows, signal)
  }

  async slotItemOptions(): Promise<LabSlotItemOptions> {
    const rows = await this.repository.readLabItemPrices()

    return await this.slotItemOptionsOf(rows)
  }

  /** 시뮬레이터 화면이 받는 마법부여와 칭호, 크리쳐, 오라 선택지를 실험실 목록 한 번 읽은 것으로 만든다. */
  async simulatorOptions(signal: AbortSignal): Promise<[LabEnchantOptions, LabSlotItemOptions]> {
    const rows = await this.repository.readLabItemPrices()

    return await Promise.all([this.enchantOptionsOf(rows, signal), this.slotItemOptionsOf(rows)])
  }

  async get(signal: AbortSignal): Promise<LabItems> {
    const rows = await this.repository.readLabItemPrices()
    const fames = await this.neopleFames(rows, signal)
    const toItem = (row: LabItemPriceRow) => toPrice(row, fameOf(row, fames), row.candidate)
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

  private async cachedIcon(key: string, read: IconRead): Promise<LabCurrencyIcon | null> {
    const icon = await this.icons.fetch(key, { context: read })

    if (icon === undefined) {
      return null
    }

    return icon
  }

  readCurrencyIcon(id: number, version: string): Promise<LabCurrencyIcon | null> {
    return this.cachedIcon(JSON.stringify(['currency', id, version]), () =>
      this.repository.readCurrencyIcon(id)
    )
  }

  readItemIcon(itemName: string, version: string): Promise<LabCurrencyIcon | null> {
    return this.cachedIcon(JSON.stringify(['item', itemName, version]), () =>
      this.repository.readItemIcon(itemName)
    )
  }
}
