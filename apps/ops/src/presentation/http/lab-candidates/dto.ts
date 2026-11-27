import type {
  AuctionPriceHistoryEntry,
  LabCandidateKind,
  LabCandidateQuery
} from '@dfragon/database'
import { ENCHANT_GRADE_SLOTS } from '@dfragon/lib/enchant-grades'
import { LAB_ITEM_CATEGORIES, LAB_ITEM_RARITIES, LAB_ITEM_ROLES } from '@dfragon/lib/lab-items'
import { z } from 'zod'
import type { LabCandidateView } from '#application/lab-candidates/index.js'
import { OpsFailure } from '#domain/failure.js'
import {
  cardField,
  descriptionField,
  iconField,
  itemNameField,
  statusField,
  typeDetailField
} from '#presentation/http/lab-fields.js'

const LAB_CANDIDATE_KINDS = [
  'TITLE',
  'CREATURE',
  'AURA',
  'ENCHANT'
] as const satisfies readonly LabCandidateKind[]

const ENCHANT_ROLES = ['dealer', 'buffer'] as const

// 스크립트가 16KiB 본문 안에 나눠 보내는 묶음 크기다.
const BATCH_MAX_COUNT = 50
const BUFF_LINE_MAX_COUNT = 30
const BUFF_LINE_MAX_LENGTH = 100
const SNAPSHOT_ID_MAX_LENGTH = 64
const SOURCE_ITEM_ID_MAX_LENGTH = 64

const snapshotIdField = z.string().trim().min(1).max(SNAPSHOT_ID_MAX_LENGTH)

function hasUniqueValues(values: readonly string[]): boolean {
  return new Set(values).size === values.length
}

const enchantCategories: readonly string[] = ENCHANT_GRADE_SLOTS
const enchantRoles: readonly string[] = ENCHANT_ROLES

type KindFields = { kind: LabCandidateKind; categories: string[]; roles: string[] }

// 마법부여 카드는 부여 부위와 딜러, 버퍼로 나뉘고, 나머지는 종류 하나에 역할을 나누지 않는다.
function matchesKind({ kind, categories, roles }: KindFields): boolean {
  if (kind !== 'ENCHANT') {
    return (
      categories.length === 1 && categories[0] === kind && roles.length === 1 && roles[0] === 'all'
    )
  }

  return (
    categories.length > 0 &&
    categories.every((category) => enchantCategories.includes(category)) &&
    hasUniqueValues(categories) &&
    roles.length > 0 &&
    roles.every((role) => enchantRoles.includes(role)) &&
    hasUniqueValues(roles)
  )
}

const candidateField = z
  .object({
    itemName: itemNameField,
    kind: z.enum(LAB_CANDIDATE_KINDS),
    categories: z.array(z.enum(LAB_ITEM_CATEGORIES)),
    roles: z.array(z.enum(LAB_ITEM_ROLES)),
    itemRarity: z.enum(LAB_ITEM_RARITIES).nullable(),
    fame: z.int32().positive().nullable(),
    availableLevel: z.int32().positive().nullable(),
    itemTypeDetail: typeDetailField,
    options: statusField,
    buffLines: z.array(z.string().trim().min(1).max(BUFF_LINE_MAX_LENGTH)).max(BUFF_LINE_MAX_COUNT),
    card: cardField.nullable(),
    description: descriptionField,
    sourceItemId: z.string().trim().min(1).max(SOURCE_ITEM_ID_MAX_LENGTH)
  })
  .refine(matchesKind)

export const batchBody = z.object({
  snapshotId: snapshotIdField,
  items: z
    .array(candidateField)
    .min(1)
    .max(BATCH_MAX_COUNT)
    .refine((items) => hasUniqueValues(items.map(({ itemName }) => itemName)))
})

export const iconBody = z.object({ itemName: itemNameField, icon: iconField })

export const finishBody = z.object({ snapshotId: snapshotIdField })

const listQuery = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.enum(['TITLE', 'CREATURE', 'AURA']) }),
  z.strictObject({
    kind: z.literal('ENCHANT'),
    category: z.enum(ENCHANT_GRADE_SLOTS),
    role: z.enum(ENCHANT_ROLES)
  })
])

export function readListQuery(query: Record<string, string>): LabCandidateQuery {
  const parsed = listQuery.safeParse(query)

  if (!parsed.success) {
    throw new OpsFailure('request')
  }

  return parsed.data
}

export type LabCandidateListResponse = {
  candidates: LabCandidateView[]
}

export function toLabCandidateListResponse(
  candidates: LabCandidateView[]
): LabCandidateListResponse {
  return { candidates }
}

export type LabCandidatePriceHistoryResponse = {
  history: AuctionPriceHistoryEntry[]
}

export function toLabCandidatePriceHistoryResponse(
  history: AuctionPriceHistoryEntry[]
): LabCandidatePriceHistoryResponse {
  return { history }
}
