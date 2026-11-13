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
  activeRun: runSchema.nullable(),
  lastFinishedRun: runSchema.nullable()
})

export const jobListSchema = z.object({
  workerSeenAt: timestamp.nullable(),
  jobs: z.array(jobSchema)
})

export const runPageSchema = z.object({
  runs: z.array(runSchema),
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
