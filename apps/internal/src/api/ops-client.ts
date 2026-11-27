import ky, { type KyInstance, type KyResponse } from 'ky'
import type { z } from 'zod'
import {
  type BatchKeyList,
  batchKeyAdditionSchema,
  batchKeyListSchema,
  type Collection,
  collectionSchema,
  failureSchema,
  type JobList,
  jobListSchema,
  type LabCurrencyList,
  type LabItemCard,
  type LabItemDetailList,
  type LabItemGroup,
  type LabItemList,
  labCurrencyAdditionSchema,
  labCurrencyListSchema,
  labItemDetailListSchema,
  labItemListSchema,
  type QueueList,
  queueListSchema,
  requeueSchema,
  type RunPage,
  runPageSchema,
  runRequestSchema
} from './ops-schemas'

export const JOB_ALREADY_RUNNING = 'JOB_ALREADY_RUNNING'
export const BATCH_NEOPLE_KEY_DUPLICATE = 'BATCH_NEOPLE_KEY_DUPLICATE'
export const LAB_CURRENCY_DUPLICATE = 'LAB_CURRENCY_DUPLICATE'

export class OpsRequestFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined
  ) {
    super(code ?? `HTTP ${status}`)
    this.name = 'OpsRequestFailure'
  }
}

export type LabCurrencyDraft = { name: string; description: string }

// icon을 빼면 저장한 아이콘을 그대로 두고, null이면 지운다.
export type LabItemDetailDraft = {
  itemName: string
  description: string
  itemRarity: string | null
  itemTypeDetail: string
  availableLevel: number | null
  fame: number | null
  card: LabItemCard | null
  icon?: string | null
}

export type OpsClient = {
  readJobs: () => Promise<JobList>
  readRuns: (before: number | undefined) => Promise<RunPage>
  requestRun: (name: string, args: Record<string, unknown>) => Promise<void>
  setPaused: (name: string, paused: boolean) => Promise<void>
  readQueues: () => Promise<QueueList>
  readCollection: () => Promise<Collection>
  requeue: (failure: string | undefined) => Promise<number>
  readBatchKeys: () => Promise<BatchKeyList>
  addBatchKey: (label: string, key: string) => Promise<void>
  setBatchKeyEnabled: (id: number, enabled: boolean) => Promise<void>
  deleteBatchKey: (id: number) => Promise<void>
  readLabItems: () => Promise<LabItemList>
  replaceLabItems: (group: LabItemGroup) => Promise<void>
  readLabCurrencies: () => Promise<LabCurrencyList>
  addLabCurrency: (currency: LabCurrencyDraft, icon: string) => Promise<void>
  updateLabCurrency: (
    id: number,
    currency: LabCurrencyDraft,
    icon: string | undefined
  ) => Promise<void>
  labCurrencyIconUrl: (id: number, updatedAt: Date) => string
  readLabItemDetails: () => Promise<LabItemDetailList>
  saveLabItemDetail: (detail: LabItemDetailDraft) => Promise<void>
  labItemIconUrl: (itemName: string, updatedAt: Date) => string
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

function batchKeyPath(id: number, action?: string): string {
  const path = `batch-neople-keys/${id}`

  if (action === undefined) {
    return path
  }

  return `${path}/${action}`
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
    readRuns: async (before) => {
      const searchParams = before !== undefined ? { before } : {}

      return readBody(await http.get('jobs/runs', { searchParams }), runPageSchema)
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
    },
    readBatchKeys: async () => readBody(await http.get('batch-neople-keys'), batchKeyListSchema),
    addBatchKey: async (label, key) => {
      await readBody(
        await http.post('batch-neople-keys', { json: { label, key } }),
        batchKeyAdditionSchema
      )
    },
    setBatchKeyEnabled: async (id, enabled) => {
      const action = enabled ? 'enable' : 'disable'
      const path = batchKeyPath(id, action)
      await expectNoContent(await http.post(path, { json: {} }))
    },
    deleteBatchKey: async (id) => {
      const path = batchKeyPath(id)
      await expectNoContent(await http.delete(path, { json: {} }))
    },
    readLabItems: async () => readBody(await http.get('lab-items'), labItemListSchema),
    replaceLabItems: async (group) => {
      await expectNoContent(await http.put('lab-items', { json: group }))
    },
    readLabCurrencies: async () =>
      readBody(await http.get('lab-currencies'), labCurrencyListSchema),
    addLabCurrency: async ({ name, description }, icon) => {
      await readBody(
        await http.post('lab-currencies', { json: { name, description, icon } }),
        labCurrencyAdditionSchema
      )
    },
    updateLabCurrency: async (id, { name, description }, icon) => {
      const json = { name, description, icon }
      await expectNoContent(await http.put(`lab-currencies/${id}`, { json }))
    },
    labCurrencyIconUrl: (id, updatedAt) =>
      new URL(`lab-currencies/${id}/icon?v=${updatedAt.getTime()}`, baseUrl).href,
    readLabItemDetails: async () =>
      readBody(await http.get('lab-item-details'), labItemDetailListSchema),
    saveLabItemDetail: async (detail) => {
      await expectNoContent(await http.put('lab-item-details', { json: detail }))
    },
    labItemIconUrl: (itemName, updatedAt) => {
      const query = new URLSearchParams({ itemName, v: String(updatedAt.getTime()) })

      return new URL(`lab-item-details/icon?${query}`, baseUrl).href
    }
  }
}
