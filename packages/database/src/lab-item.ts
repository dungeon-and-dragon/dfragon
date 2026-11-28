import type { DatabaseClient } from './client.js'
import {
  cheapestVariantOf,
  groupByBaseName,
  isPlatinumVariant,
  isVariantGroupedKind,
  representativeOf,
  VARIANT_GROUPED_KINDS
} from './lab-candidate-variant.js'
import type { LabItemCard, LabItemTooltipFields } from './lab-item-detail.js'

export type LabItemCost = {
  currencyId: number
  count: number
}

export type LabItemEntry = {
  itemName: string
  cost: LabItemCost | null
}

export type LabItemGroup = {
  category: string
  role: string
  tier: string
  items: LabItemEntry[]
}

export async function readLabItemGroups(client: DatabaseClient): Promise<LabItemGroup[]> {
  return client.$queryRaw<LabItemGroup[]>`
    SELECT
      "category", "role", "tier",
      json_agg(
        json_build_object(
          'itemName', "item_name",
          'cost', CASE
            WHEN "currency_id" IS NULL THEN NULL
            ELSE json_build_object('currencyId', "currency_id", 'count', "currency_count")
          END
        )
        ORDER BY "id"
      ) AS "items"
    FROM "lab_items"
    GROUP BY "category", "role", "tier"
    ORDER BY "category", "role", "tier"`
}

function costColumns(cost: LabItemCost | null) {
  if (cost === null) {
    return { currencyId: null, currencyCount: null }
  }

  const currencyId = BigInt(cost.currencyId)

  return { currencyId, currencyCount: cost.count }
}

// 묶음에 남는 이름은 지우지 않아 처음 고른 시각을 그대로 둔다.
export async function replaceLabItemGroup(
  client: DatabaseClient,
  { category, role, tier, items }: LabItemGroup
): Promise<void> {
  const itemNames = items.map(({ itemName }) => itemName)
  const rows = items.map(({ itemName, cost }) => {
    const columns = costColumns(cost)

    return { category, role, tier, itemName, ...columns }
  })
  const costUpdates = items.map(({ itemName, cost }) => {
    const data = costColumns(cost)

    return client.labItem.updateMany({ where: { category, role, tier, itemName }, data })
  })

  await client.$transaction([
    client.labItem.deleteMany({
      where: { category, role, tier, itemName: { notIn: itemNames } }
    }),
    client.labItem.createMany({ data: rows, skipDuplicates: true }),
    ...costUpdates
  ])
}

export type LabItemPriceCost = {
  currencyId: number
  currencyName: string
  currencyDescription: string | null
  currencyUpdatedAt: Date
  count: number
}

export type LabItemPriceDetail = LabItemTooltipFields & {
  description: string | null
  itemRarity: string | null
  iconUpdatedAt: Date | null
}

export type LabItemStatusLine = { name: string; value: string }

// 같은 성능 판정에 쓰는 옵션 줄과 버프 줄은 후보에만 있다. itemName은 오라 상자, 크리쳐 알과 이은 후보면 실험실 이름과 다른 게임 아이템 이름이다.
export type LabItemPriceCandidate = LabItemPriceDetail & {
  itemName: string
  options: LabItemStatusLine[]
  buffLines: string[]
}

export type LabItemPriceRow = {
  category: string
  role: string
  tier: string
  itemName: string
  itemId: string | null
  itemRarity: string | null
  unitPrice: number | null
  checkedAt: Date | null
  cost: LabItemPriceCost | null
  detail: LabItemPriceDetail | null
  candidate: LabItemPriceCandidate | null
}

type StoredLabItemPriceRow = Omit<
  LabItemPriceRow,
  'unitPrice' | 'cost' | 'detail' | 'candidate'
> & {
  candidateName: string | null
  candidateDescription: string | null
  candidateRarity: string | null
  candidateIconUpdatedAt: Date | null
  candidateItemTypeDetail: string | null
  candidateAvailableLevel: number | null
  candidateFame: number | null
  candidateCard: LabItemCard | null
  candidateOptions: LabItemStatusLine[]
  candidateBuffLines: string[]
  hasDetail: boolean
  detailDescription: string | null
  detailRarity: string | null
  detailIconUpdatedAt: Date | null
  detailItemTypeDetail: string | null
  detailAvailableLevel: number | null
  detailFame: number | null
  detailCard: LabItemCard | null
  unitPrice: bigint | null
  currencyId: bigint | null
  currencyName: string | null
  currencyDescription: string | null
  currencyUpdatedAt: Date | null
  currencyCount: number | null
}

function toPriceCost({
  currencyId,
  currencyName,
  currencyDescription,
  currencyUpdatedAt,
  currencyCount
}: StoredLabItemPriceRow): LabItemPriceCost | null {
  if (
    currencyId === null ||
    currencyName === null ||
    currencyUpdatedAt === null ||
    currencyCount === null
  ) {
    return null
  }

  const id = Number(currencyId)

  return {
    currencyId: id,
    currencyName,
    currencyDescription,
    currencyUpdatedAt,
    count: currencyCount
  }
}

function toPriceDetail({
  hasDetail,
  detailDescription,
  detailRarity,
  detailIconUpdatedAt,
  detailItemTypeDetail,
  detailAvailableLevel,
  detailFame,
  detailCard
}: StoredLabItemPriceRow): LabItemPriceDetail | null {
  if (!hasDetail) {
    return null
  }

  return {
    description: detailDescription,
    itemRarity: detailRarity,
    iconUpdatedAt: detailIconUpdatedAt,
    itemTypeDetail: detailItemTypeDetail,
    availableLevel: detailAvailableLevel,
    fame: detailFame,
    card: detailCard
  }
}

function toPriceCandidate(row: StoredLabItemPriceRow): LabItemPriceCandidate | null {
  if (row.candidateName === null) {
    return null
  }

  return {
    itemName: row.candidateName,
    description: row.candidateDescription,
    itemRarity: row.candidateRarity,
    iconUpdatedAt: row.candidateIconUpdatedAt,
    itemTypeDetail: row.candidateItemTypeDetail,
    availableLevel: row.candidateAvailableLevel,
    fame: row.candidateFame,
    card: row.candidateCard,
    options: row.candidateOptions,
    buffLines: row.candidateBuffLines
  }
}

// 가격은 foreign key 없이 아이템 이름으로만 잇고, 재화는 currency_id로 잇는다.
// 오라 상자, 크리쳐 알처럼 후보에 없는 이름은 경매장 item_id가 같은 후보를 이어 같은 성능으로 묶이게 한다.
// 아이콘 route는 이름으로만 아이콘을 찾으므로 이렇게 이은 후보의 아이콘 시각은 비워 Neople 아이콘을 쓰게 한다.
export async function readLabItemPrices(client: DatabaseClient): Promise<LabItemPriceRow[]> {
  const rows = await client.$queryRaw<StoredLabItemPriceRow[]>`
    SELECT
      i."category", i."role", i."tier", i."item_name" AS "itemName",
      p."item_id" AS "itemId", p."item_rarity" AS "itemRarity",
      p."unit_price" AS "unitPrice", p."checked_at" AS "checkedAt",
      c."id" AS "currencyId", c."name" AS "currencyName", c."description" AS "currencyDescription",
      c."updated_at" AS "currencyUpdatedAt", i."currency_count" AS "currencyCount",
      d."item_name" IS NOT NULL AS "hasDetail", d."description" AS "detailDescription",
      d."item_rarity" AS "detailRarity",
      CASE WHEN d."icon" IS NULL THEN NULL ELSE d."updated_at" END AS "detailIconUpdatedAt",
      d."item_type_detail" AS "detailItemTypeDetail", d."available_level" AS "detailAvailableLevel",
      d."fame" AS "detailFame", d."card" AS "detailCard",
      candidate."item_name" AS "candidateName",
      candidate."description" AS "candidateDescription", candidate."item_rarity" AS "candidateRarity",
      CASE
        WHEN candidate."icon" IS NULL OR candidate."item_name" <> i."item_name" THEN NULL
        ELSE candidate."icon_updated_at"
      END AS "candidateIconUpdatedAt",
      candidate."item_type_detail" AS "candidateItemTypeDetail",
      candidate."available_level" AS "candidateAvailableLevel",
      candidate."fame" AS "candidateFame", candidate."card" AS "candidateCard",
      candidate."options" AS "candidateOptions", candidate."buff_lines" AS "candidateBuffLines"
    FROM "lab_items" i
    LEFT JOIN "auction_prices" p ON p."item_name" = i."item_name"
    LEFT JOIN "lab_currencies" c ON c."id" = i."currency_id"
    LEFT JOIN "lab_item_details" d ON d."item_name" = i."item_name"
    LEFT JOIN LATERAL (
      SELECT matched.* FROM "lab_candidates" matched
      WHERE matched."item_name" = i."item_name"
        OR matched."item_name" IN (
          SELECT same."item_name" FROM "auction_prices" same WHERE same."item_id" = p."item_id"
        )
      ORDER BY matched."item_name" = i."item_name" DESC, matched."item_name"
      LIMIT 1
    ) candidate ON true
    ORDER BY i."id"`

  const variantGroups = await readCandidateVariantGroups(client)

  return rows.map((row) => {
    const { category, role, tier, itemName } = row
    const variants = variantGroups.get(itemName) ?? []
    const ownPrice = row.unitPrice !== null ? Number(row.unitPrice) : null
    const own = {
      itemName,
      itemId: row.itemId,
      itemRarity: row.itemRarity,
      unitPrice: ownPrice,
      checkedAt: row.checkedAt
    }

    const normals = isVariantGroupedKind(category)
      ? variants.filter((variant) => !isPlatinumVariant(variant.itemName))
      : variants
    const { itemId, itemRarity, unitPrice, checkedAt } = cheapestVariantOf([own, ...normals])
    const cost = toPriceCost(row)
    const detail = toPriceDetail(row)
    const candidate = toPriceCandidate(row) ?? variantCandidateOf(itemName, variants)

    return {
      category,
      role,
      tier,
      itemName,
      itemId,
      itemRarity,
      unitPrice,
      checkedAt,
      cost,
      detail,
      candidate
    }
  })
}

type CandidateVariantPrice = {
  itemName: string
  itemId: string | null
  itemRarity: string | null
  unitPrice: number | null
  checkedAt: Date | null
  candidate: LabItemPriceCandidate
}

type StoredCandidateVariantPrice = Omit<CandidateVariantPrice, 'unitPrice' | 'candidate'> &
  Omit<LabItemPriceCandidate, 'itemRarity'> & {
    unitPrice: bigint | null
    candidateRarity: string | null
  }

function variantCandidateOf(
  itemName: string,
  variants: readonly CandidateVariantPrice[]
): LabItemPriceCandidate | null {
  if (variants.length === 0) {
    return null
  }

  return representativeOf(itemName, variants).candidate
}

// 실험실 아이템에 기본 이름만 저장한 칭호, 크리쳐도 변형의 가격과 후보 상세를 보이게 기본 이름으로 묶어 둔다.
async function readCandidateVariantGroups(
  client: DatabaseClient
): Promise<Map<string, CandidateVariantPrice[]>> {
  const rows = await client.$queryRaw<StoredCandidateVariantPrice[]>`
    SELECT
      c."item_name" AS "itemName", p."item_id" AS "itemId", p."item_rarity" AS "itemRarity",
      p."unit_price" AS "unitPrice", p."checked_at" AS "checkedAt",
      c."description", c."item_rarity" AS "candidateRarity",
      CASE WHEN c."icon" IS NULL THEN NULL ELSE c."icon_updated_at" END AS "iconUpdatedAt",
      c."item_type_detail" AS "itemTypeDetail", c."available_level" AS "availableLevel",
      c."fame", c."card", c."options", c."buff_lines" AS "buffLines"
    FROM "lab_candidates" c
    LEFT JOIN "auction_prices" p ON p."item_name" = c."item_name"
    WHERE c."kind" = ANY(${[...VARIANT_GROUPED_KINDS]}::text[])`

  const variants = rows.map((row) => {
    const unitPrice = row.unitPrice !== null ? Number(row.unitPrice) : null

    return {
      itemName: row.itemName,
      itemId: row.itemId,
      itemRarity: row.itemRarity,
      unitPrice,
      checkedAt: row.checkedAt,
      candidate: {
        itemName: row.itemName,
        description: row.description,
        itemRarity: row.candidateRarity,
        iconUpdatedAt: row.iconUpdatedAt,
        itemTypeDetail: row.itemTypeDetail,
        availableLevel: row.availableLevel,
        fame: row.fame,
        card: row.card,
        options: row.options,
        buffLines: row.buffLines
      }
    }
  })

  return groupByBaseName(variants)
}
