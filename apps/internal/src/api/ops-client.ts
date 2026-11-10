import ky, { type KyInstance, type KyResponse } from 'ky'
import type { z } from 'zod'
import {
  type Collection,
  collectionSchema,
  failureSchema,
  type JobList,
  jobListSchema,
  type QueueList,
  queueListSchema,
  requeueSchema,
  type RunPage,
  runPageSchema,
  runRequestSchema
} from './ops-schemas'

export const JOB_ALREADY_RUNNING = 'JOB_ALREADY_RUNNING'

export class OpsRequestFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined
  ) {
    super(code ?? `HTTP ${status}`)
    this.name = 'OpsRequestFailure'
  }
}

export type OpsClient = {
  readJobs: () => Promise<JobList>
  readRuns: (name: string, before: number | undefined) => Promise<RunPage>
  requestRun: (name: string, args: Record<string, unknown>) => Promise<void>
  setPaused: (name: string, paused: boolean) => Promise<void>
  readQueues: () => Promise<QueueList>
  readCollection: () => Promise<Collection>
  requeue: (failure: string | undefined) => Promise<number>
}

async function throwFailure(response: KyResponse): Promise<never> {
  const body: unknown = await response.json().catch(() => undefined)
  const failure = failureSchema.safeParse(body)
  throw new OpsRequestFailure(response.status, failure.data?.error.code)
}

async function readBody<Schema extends z.ZodType>(
  response: KyResponse,
  schema: Schema
): Promise<z.output<Schema>> {
  if (!response.ok) {
    return throwFailure(response)
  }

  return schema.parse(await response.json())
}

async function expectNoContent(response: KyResponse): Promise<void> {
  if (!response.ok) {
    await throwFailure(response)
  }
}

function jobPath(name: string, action: string): string {
  return `jobs/${encodeURIComponent(name)}/${action}`
}

export function createOpsClient(baseUrl: string, transport: typeof fetch): OpsClient {
  // 화면이 1초마다 다시 읽으므로 ky가 따로 재시도하지 않는다.
  const http: KyInstance = ky.create({
    baseUrl,
    fetch: transport,
    retry: 0,
    throwHttpErrors: false,
    cache: 'no-store'
  })

  return {
    readJobs: async () => readBody(await http.get('jobs'), jobListSchema),
    readRuns: async (name, before) => {
      const searchParams = before !== undefined ? { before } : {}

      return readBody(await http.get(jobPath(name, 'runs'), { searchParams }), runPageSchema)
    },
    requestRun: async (name, args) => {
      await readBody(await http.post(jobPath(name, 'runs'), { json: { args } }), runRequestSchema)
    },
    setPaused: async (name, paused) => {
      const action = paused ? 'pause' : 'resume'
      await expectNoContent(await http.post(jobPath(name, action), { json: {} }))
    },
    readQueues: async () => readBody(await http.get('queues'), queueListSchema),
    readCollection: async () => readBody(await http.get('collection'), collectionSchema),
    requeue: async (failure) => {
      const body = failure !== undefined ? { failure } : {}
      const { requeued } = await readBody(
        await http.post('collection/requeue', { json: body }),
        requeueSchema
      )

      return requeued
    }
  }
}
