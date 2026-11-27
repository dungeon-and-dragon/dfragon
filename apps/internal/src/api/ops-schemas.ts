import { LAB_ITEM_CATEGORIES, LAB_ITEM_TIERS } from '@dfragon/lib/lab-items'
import { z } from 'zod'

const timestamp = z.iso.datetime().transform((value) => new Date(value))
const count = z.int().nonnegative()

export const runTriggerSchema = z.enum(['schedule', 'catchup', 'manual'])
export const runStatusSchema = z.enum([
  'requested',
  'running',
  'succeeded',
  'failed',
  'interrupted'
])

const runSchema = z.object({
  id: z.int().positive(),
  trigger: runTriggerSchema,
  status: runStatusSchema,
  requestedAt: timestamp,
  startedAt: timestamp.nullable(),
  finishedAt: timestamp.nullable(),
  progress: z.object({ done: count, total: count.nullable() }).nullable(),
  summary: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .nullable(),
  error: z.array(z.object({ name: z.string(), code: z.string().optional() })).nullable()
})

// worker가 zod 인자 schema를 z.toJSONSchema로 바꿔 올린다. 입력 칸을 그리는 데 쓰는 키만 읽는다.
const argFieldSchema = z.object({
  type: z.string().optional(),
  enum: z.array(z.union([z.string(), z.number()])).optional()
})

const argsSchemaSchema = z.object({
  properties: z.record(z.string(), argFieldSchema).optional(),
  required: z.array(z.string()).optional()
})

const jobSchema = z.object({
  name: z.string().min(1),
  displayName: z.string(),
  description: z.string(),
  schedule: z.string().nullable(),
  paused: z.boolean(),
  nextRunAt: timestamp.nullable(),
  argsSchema: argsSchemaSchema,
  delayMinutes: count,
  neopleApi: z.object({ group: z.string(), endpoints: z.array(z.string()) }).nullable(),
  activeRun: runSchema.nullable(),
  lastFinishedRun: runSchema.nullable()
})

export const jobListSchema = z.object({
  workerSeenAt: timestamp.nullable(),
  jobs: z.array(jobSchema)
})

export const runPageSchema = z.object({
  runs: z.array(runSchema.extend({ jobName: z.string() })),
  nextBefore: z.int().positive().nullable()
})

export const runRequestSchema = z.object({ id: z.int().positive() })

export const queueListSchema = z.object({
  queues: z.array(z.object({ name: z.string(), waiting: count, running: count }))
})

export const collectionSchema = z.object({
  waiting: count,
  oldestQueuedAt: timestamp.nullable(),
  failures: z.array(z.object({ failure: z.string(), count, lastAttemptedAt: timestamp.nullable() }))
})

export const requeueSchema = z.object({ requeued: count })

const batchKeySchema = z.object({
  id: z.int().positive(),
  label: z.string(),
  keySuffix: z.string(),
  enabled: z.boolean(),
  createdAt: timestamp,
  rejectedAt: timestamp.nullable()
})

export const batchKeyListSchema = z.object({ keys: z.array(batchKeySchema) })

export const batchKeyAdditionSchema = z.object({ id: z.int().positive() })

const labItemCostSchema = z.object({ currencyId: z.int().positive(), count: z.int().positive() })

const labItemSchema = z.object({ itemName: z.string(), cost: labItemCostSchema.nullable() })

const labItemGroupSchema = z.object({
  category: z.string(),
  role: z.string(),
  tier: z.string(),
  items: z.array(labItemSchema)
})

export const labItemListSchema = z.object({ groups: z.array(labItemGroupSchema) })

const labCurrencySchema = z.object({
  id: z.int().positive(),
  name: z.string(),
  description: z.string().nullable(),
  updatedAt: timestamp
})

export const labCurrencyListSchema = z.object({ currencies: z.array(labCurrencySchema) })

const labItemCardSchema = z.object({
  slots: z.array(z.string()),
  enchants: z.array(
    z.object({
      upgrade: z.int(),
      status: z.array(z.object({ name: z.string(), value: z.string() }))
    })
  )
})

const labItemDetailSchema = z.object({
  itemName: z.string(),
  description: z.string().nullable(),
  itemRarity: z.string().nullable(),
  itemTypeDetail: z.string().nullable(),
  availableLevel: z.int().nullable(),
  fame: z.int().nullable(),
  card: labItemCardSchema.nullable(),
  hasIcon: z.boolean(),
  updatedAt: timestamp
})

export const labItemDetailListSchema = z.object({ details: z.array(labItemDetailSchema) })

export const labCurrencyAdditionSchema = z.object({ id: z.int().positive() })

const statusLineSchema = z.object({ name: z.string(), value: z.string() })

const labCandidateSchema = z.object({
  itemName: z.string(),
  kind: z.enum(['TITLE', 'CREATURE', 'AURA', 'ENCHANT']),
  categories: z.array(z.enum(LAB_ITEM_CATEGORIES)),
  itemRarity: z.string().nullable(),
  fame: z.int().nullable(),
  availableLevel: z.int().nullable(),
  itemTypeDetail: z.string().nullable(),
  options: z.array(statusLineSchema),
  buffLines: z.array(z.string()),
  card: labItemCardSchema.nullable(),
  description: z.string().nullable(),
  hasIcon: z.boolean(),
  iconUpdatedAt: timestamp.nullable(),
  unitPrice: z.number().nullable(),
  previousPrice: z.object({ unitPrice: z.number().nullable() }).nullable(),
  wearCount: z.int().nullable(),
  wearCountedAt: timestamp.nullable(),
  priceItemName: z.string(),
  recommendedTier: z.enum(LAB_ITEM_TIERS).nullable(),
  badge: z.enum(['미조회', '검색 없음', '매물 없음']).nullable()
})

export const labCandidateListSchema = z.object({ candidates: z.array(labCandidateSchema) })

const priceHistoryEntrySchema = z.object({
  id: z.int(),
  unitPrice: z.number().nullable(),
  checkedAt: timestamp
})

export const labCandidatePriceHistorySchema = z.object({
  history: z.array(priceHistoryEntrySchema)
})

const labCandidateExclusionSchema = z.object({ itemName: z.string(), excludedAt: timestamp })

export const labCandidateExclusionListSchema = z.object({
  exclusions: z.array(labCandidateExclusionSchema)
})

export const failureSchema = z.object({ error: z.object({ code: z.string() }) })

export type RunTrigger = z.infer<typeof runTriggerSchema>
export type RunStatus = z.infer<typeof runStatusSchema>
export type Run = z.infer<typeof runSchema>
export type ArgField = z.infer<typeof argFieldSchema>
export type Job = z.infer<typeof jobSchema>
export type JobList = z.infer<typeof jobListSchema>
export type RunPage = z.infer<typeof runPageSchema>
export type QueueList = z.infer<typeof queueListSchema>
export type Collection = z.infer<typeof collectionSchema>
export type BatchKey = z.infer<typeof batchKeySchema>
export type BatchKeyList = z.infer<typeof batchKeyListSchema>
export type LabItemCost = z.infer<typeof labItemCostSchema>
export type LabItem = z.infer<typeof labItemSchema>
export type LabItemGroup = z.infer<typeof labItemGroupSchema>
export type LabCurrency = z.infer<typeof labCurrencySchema>
export type LabCurrencyList = z.infer<typeof labCurrencyListSchema>
export type LabItemCard = z.infer<typeof labItemCardSchema>
export type LabItemDetail = z.infer<typeof labItemDetailSchema>
export type LabItemDetailList = z.infer<typeof labItemDetailListSchema>
export type LabItemList = z.infer<typeof labItemListSchema>
export type LabCandidate = z.infer<typeof labCandidateSchema>
export type LabCandidateKind = LabCandidate['kind']
export type LabCandidateBadge = NonNullable<LabCandidate['badge']>
export type LabCandidateList = z.infer<typeof labCandidateListSchema>
export type PriceHistoryEntry = z.infer<typeof priceHistoryEntrySchema>
export type LabCandidatePriceHistory = z.infer<typeof labCandidatePriceHistorySchema>
export type LabCandidateExclusion = z.infer<typeof labCandidateExclusionSchema>
export type LabCandidateExclusionList = z.infer<typeof labCandidateExclusionListSchema>
