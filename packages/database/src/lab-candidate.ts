import { labItemBaseName } from '@dfragon/lib/lab-items'
import type { LabItemPriceTarget } from './auction-price.js'
import type { DatabaseClient } from './client.js'
import type { Prisma } from './generated/prisma/client.js'
import type { LabCurrencyIcon } from './lab-currency.js'
import type { LabItemTooltipFields } from './lab-item-detail.js'
import {
  cheapestVariantOf,
  compareVariants,
  groupByBaseName,
  isVariantGroupedKind,
  representativeOf,
  VARIANT_GROUPED_KINDS
} from './lab-candidate-variant.js'

export type LabCandidateKind = 'TITLE' | 'CREATURE' | 'AURA' | 'ENCHANT'

export type LabCandidateInput = LabItemTooltipFields & {
  itemName: string
  kind: LabCandidateKind
  categories: string[]
  roles: string[]
  itemRarity: string | null
  options: Prisma.JsonArray
  buffLines: Prisma.JsonArray
  description: string | null
  sourceItemId: string
}

export type LabCandidateBatch = {
  versionId: string
  importedAt: Date
  items: LabCandidateInput[]
}

export type LabCandidateBatchResult = {
  saved: number
  skipped: string[]
}

function exclusionNamesOf({ itemName, kind }: LabCandidateInput): string[] {
  if (!isVariantGroupedKind(kind)) {
    return [itemName]
  }

  return [itemName, labItemBaseName(itemName)]
}

export async function upsertLabCandidates(
  client: DatabaseClient,
  { versionId, importedAt, items }: LabCandidateBatch
): Promise<LabCandidateBatchResult> {
  const exclusionNames = items.flatMap(exclusionNamesOf)
  const exclusions = await client.labCandidateExclusion.findMany({
    where: { itemName: { in: exclusionNames } },
    select: { itemName: true }
  })
  const excluded = new Set(exclusions.map(({ itemName }) => itemName))
  const isExcluded = (item: LabCandidateInput) =>
    exclusionNamesOf(item).some((name) => excluded.has(name))

  const kept = items.filter((item) => !isExcluded(item))
  const skipped = items.filter(isExcluded).map(({ itemName }) => itemName)

  const writes = kept.map((item) => {
    const options = JSON.stringify(item.options)
    const buffLines = JSON.stringify(item.buffLines)
    const card = item.card !== null ? JSON.stringify(item.card) : null

    return client.$executeRaw`
      INSERT INTO "lab_candidates" (
        "item_name", "kind", "categories", "roles", "item_rarity", "fame",
        "available_level", "item_type_detail", "options", "buff_lines", "card",
        "description", "version_id", "source_item_id", "imported_at"
      ) VALUES (
        ${item.itemName}, ${item.kind}, ${item.categories}::text[], ${item.roles}::text[],
        ${item.itemRarity}, ${item.fame}::integer, ${item.availableLevel}::integer,
        ${item.itemTypeDetail}, ${options}::jsonb, ${buffLines}::jsonb, ${card}::jsonb,
        ${item.description}, ${versionId}, ${item.sourceItemId}, ${importedAt}
      )
      ON CONFLICT ("item_name") DO UPDATE SET
        "kind" = EXCLUDED."kind", "categories" = EXCLUDED."categories",
        "roles" = EXCLUDED."roles", "item_rarity" = EXCLUDED."item_rarity",
        "fame" = EXCLUDED."fame", "available_level" = EXCLUDED."available_level",
        "item_type_detail" = EXCLUDED."item_type_detail", "options" = EXCLUDED."options",
        "buff_lines" = EXCLUDED."buff_lines", "card" = EXCLUDED."card",
        "description" = EXCLUDED."description", "version_id" = EXCLUDED."version_id",
        "source_item_id" = EXCLUDED."source_item_id", "imported_at" = EXCLUDED."imported_at"`
  })

  await client.$transaction(writes)

  return { saved: kept.length, skipped }
}

export async function saveLabCandidateIcon(
  client: DatabaseClient,
  itemName: string,
  { bytes, contentType }: LabCurrencyIcon
): Promise<{ status: 'updated' | 'notFound' }> {
  const count = await client.$executeRaw`
    UPDATE "lab_candidates"
    SET "icon" = ${bytes}::bytea, "icon_content_type" = ${contentType},
      "icon_updated_at" = CURRENT_TIMESTAMP
    WHERE "item_name" = ${itemName}`

  const status = count === 0 ? 'notFound' : 'updated'

  return { status }
}

async function readIconRow(client: DatabaseClient, itemName: string) {
  return client.labCandidate.findUnique({
    where: { itemName },
    select: { icon: true, iconContentType: true }
  })
}

// 기본 이름 줄이 없는 칭호, 크리쳐 묶음은 기본 이름으로 아이콘을 요청하므로, 묶은 줄의 값을 정하는 변형의 아이콘을 낸다.
async function readVariantIconRow(client: DatabaseClient, baseName: string) {
  const grouped = await client.labCandidate.findMany({
    where: { kind: { in: [...VARIANT_GROUPED_KINDS] } },
    select: { itemName: true }
  })

  const variants = grouped.filter((row) => labItemBaseName(row.itemName) === baseName)

  if (variants.length === 0) {
    return null
  }

  const { itemName } = representativeOf(baseName, variants)

  return readIconRow(client, itemName)
}

export async function readLabCandidateIcon(
  client: DatabaseClient,
  itemName: string
): Promise<LabCurrencyIcon | null> {
  const row = (await readIconRow(client, itemName)) ?? (await readVariantIconRow(client, itemName))

  if (row === null || row.icon === null || row.iconContentType === null) {
    return null
  }

  return { bytes: row.icon, contentType: row.iconContentType }
}

export async function deleteLabCandidatesOtherVersions(
  client: DatabaseClient,
  versionId: string
): Promise<{ remaining: number; deleted: number }> {
  return client.$transaction(async (transaction) => {
    const remaining = await transaction.labCandidate.count({ where: { versionId } })

    // import가 없는 판으로 finish를 호출해 전체 후보를 지우지 않는다.
    if (remaining === 0) {
      return { remaining, deleted: 0 }
    }

    const { count } = await transaction.labCandidate.deleteMany({
      where: { versionId: { not: versionId } }
    })

    return { remaining, deleted: count }
  })
}

export type LabCandidateQuery = {
  kind?: LabCandidateKind
  category?: string
  role?: string
}

export type LabCandidatePreviousPrice = {
  itemId: string | null
  unitPrice: number | null
  checkedAt: Date
}

export type LabCandidateSummary = LabCandidateInput & {
  versionId: string
  importedAt: Date
  hasIcon: boolean
  iconUpdatedAt: Date | null
  itemId: string | null
  unitPrice: number | null
  checkedAt: Date | null
  previousPrice: LabCandidatePreviousPrice | null
  wearCount: number | null
  wearCountedAt: Date | null
}

type StoredLabCandidate = Omit<LabCandidateSummary, 'unitPrice' | 'previousPrice'> & {
  unitPrice: bigint | null
  previousItemId: string | null
  previousUnitPrice: bigint | null
  previousCheckedAt: Date | null
}

export async function readLabCandidates(
  client: DatabaseClient,
  query: LabCandidateQuery = {}
): Promise<LabCandidateSummary[]> {
  const kind = query.kind ?? null
  const category = query.category ?? null
  const role = query.role ?? null
  const rows = await client.$queryRaw<StoredLabCandidate[]>`
    SELECT
      c."item_name" AS "itemName", c."kind", c."categories", c."roles",
      c."item_rarity" AS "itemRarity", c."fame", c."available_level" AS "availableLevel",
      c."item_type_detail" AS "itemTypeDetail", c."options", c."buff_lines" AS "buffLines",
      c."card", c."description", c."version_id" AS "versionId",
      c."source_item_id" AS "sourceItemId", c."imported_at" AS "importedAt",
      c."icon" IS NOT NULL AS "hasIcon", c."icon_updated_at" AS "iconUpdatedAt",
      p."item_id" AS "itemId", p."unit_price" AS "unitPrice", p."checked_at" AS "checkedAt",
      h."item_id" AS "previousItemId", h."unit_price" AS "previousUnitPrice",
      h."checked_at" AS "previousCheckedAt",
      CASE WHEN worn."slot_id" IS NOT NULL THEN COALESCE(w."count", 0) END AS "wearCount",
      CASE WHEN worn."slot_id" IS NOT NULL THEN counted."at" END AS "wearCountedAt"
    FROM "lab_candidates" c
    CROSS JOIN (SELECT max("computed_at") AS "at" FROM "lab_candidate_wear_counts") counted
    LEFT JOIN (VALUES ('TITLE', 'TITLE'), ('AURA', 'AURORA'), ('CREATURE', 'CREATURE'))
      AS worn ("kind", "slot_id") ON worn."kind" = c."kind" AND counted."at" IS NOT NULL
    LEFT JOIN "lab_candidate_wear_counts" w
      ON w."item_name" = c."item_name" AND w."slot_id" = worn."slot_id"
    LEFT JOIN "auction_prices" p ON p."item_name" = c."item_name"
    LEFT JOIN LATERAL (
      SELECT "item_id", "unit_price", "checked_at"
      FROM "auction_price_history"
      WHERE "item_name" = c."item_name" AND "checked_at" <= p."checked_at"
        AND "unit_price" IS DISTINCT FROM p."unit_price"
      ORDER BY "checked_at" DESC, "id" DESC
      LIMIT 1
    ) h ON TRUE
    WHERE (${kind}::text IS NULL OR c."kind" = ${kind})
      AND (${category}::text IS NULL OR ${category} = ANY(c."categories"))
      AND (${role}::text IS NULL OR ${role} = ANY(c."roles"))
    ORDER BY c."fame" DESC NULLS LAST, c."item_name"`

  const candidates = rows.map(
    ({ unitPrice, previousItemId, previousUnitPrice, previousCheckedAt, ...row }) => {
      let previousPrice: LabCandidatePreviousPrice | null = null

      if (previousCheckedAt !== null) {
        const price = previousUnitPrice !== null ? Number(previousUnitPrice) : null
        previousPrice = { itemId: previousItemId, unitPrice: price, checkedAt: previousCheckedAt }
      }

      const price = unitPrice !== null ? Number(unitPrice) : null

      return { ...row, unitPrice: price, previousPrice }
    }
  )

  return groupLabCandidateVariants(candidates)
}

function sumWearCounts(rows: readonly LabCandidateSummary[]): number | null {
  const counts = rows.flatMap(({ wearCount }) => (wearCount !== null ? [wearCount] : []))

  if (counts.length === 0) {
    return null
  }

  return counts.reduce((total, count) => total + count, 0)
}

function mergeVariants(baseName: string, rows: LabCandidateSummary[]): LabCandidateSummary {
  const sorted = [...rows].sort((left, right) =>
    compareVariants(baseName, left.itemName, right.itemName)
  )

  const representative = sorted[0]
  const { itemId, unitPrice, checkedAt, previousPrice } = cheapestVariantOf(sorted)
  const wearCount = sumWearCounts(sorted)

  return {
    ...representative,
    itemName: baseName,
    itemId,
    unitPrice,
    checkedAt,
    previousPrice,
    wearCount
  }
}

// SQL의 명성, 이름 순서를 지키도록 묶음은 처음 나온 변형 자리에 둔다.
function groupLabCandidateVariants(candidates: LabCandidateSummary[]): LabCandidateSummary[] {
  const grouped = candidates.filter(({ kind }) => isVariantGroupedKind(kind))
  const groups = groupByBaseName(grouped)
  const placed = new Set<string>()
  const result: LabCandidateSummary[] = []

  for (const candidate of candidates) {
    if (!isVariantGroupedKind(candidate.kind)) {
      result.push(candidate)
      continue
    }

    const baseName = labItemBaseName(candidate.itemName)

    if (placed.has(baseName)) {
      continue
    }

    const variants = groups.get(baseName) ?? [candidate]
    const merged = mergeVariants(baseName, variants)

    placed.add(baseName)
    result.push(merged)
  }

  return result
}

export async function readLabCandidatePriceTargets(
  client: DatabaseClient
): Promise<LabItemPriceTarget[]> {
  return client.$queryRaw<LabItemPriceTarget[]>`
    SELECT c."item_name" AS "itemName", FALSE AS "exchanged", c."categories"
    FROM "lab_candidates" c
    WHERE NOT EXISTS (SELECT 1 FROM "lab_items" i WHERE i."item_name" = c."item_name")
    ORDER BY c."item_name"`
}
