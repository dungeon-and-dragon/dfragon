import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult
} from '@tanstack/react-query'
import { createContext, use } from 'react'
import type { OpsClient } from './api/ops-client'

export const REFRESH_INTERVAL_MS = 1_000

const JOBS_KEY = ['jobs'] as const
const QUEUES_KEY = ['queues'] as const
const COLLECTION_KEY = ['collection'] as const
const BATCH_KEYS_KEY = ['batch-keys'] as const

export const OpsClientContext = createContext<OpsClient | null>(null)

function useOpsClient(): OpsClient {
  const client = use(OpsClientContext)
  if (client === null) {
    throw new Error('OpsClientContext가 없습니다.')
  }

  return client
}

export function useJobs() {
  const client = useOpsClient()

  return useQuery({
    queryKey: JOBS_KEY,
    queryFn: client.readJobs,
    refetchInterval: REFRESH_INTERVAL_MS
  })
}

export function useJobRuns(name: string) {
  const client = useOpsClient()

  return useInfiniteQuery({
    queryKey: [...JOBS_KEY, name, 'runs'],
    queryFn: ({ pageParam }) => client.readRuns(name, pageParam),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (page) => page.nextBefore,
    refetchInterval: REFRESH_INTERVAL_MS
  })
}

export function useQueues() {
  const client = useOpsClient()

  return useQuery({
    queryKey: QUEUES_KEY,
    queryFn: client.readQueues,
    refetchInterval: REFRESH_INTERVAL_MS
  })
}

export function useCollection() {
  const client = useOpsClient()

  return useQuery({
    queryKey: COLLECTION_KEY,
    queryFn: client.readCollection,
    refetchInterval: REFRESH_INTERVAL_MS
  })
}

export function useBatchKeys() {
  const client = useOpsClient()

  return useQuery({
    queryKey: BATCH_KEYS_KEY,
    queryFn: client.readBatchKeys,
    refetchInterval: REFRESH_INTERVAL_MS
  })
}

type RunRequest = { name: string; args: Record<string, unknown> }

export function useRequestRun(): UseMutationResult<void, Error, RunRequest> {
  const client = useOpsClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ name, args }: RunRequest) => client.requestRun(name, args),
    onSettled: () => queryClient.invalidateQueries({ queryKey: JOBS_KEY })
  })
}

type PauseChange = { name: string; paused: boolean }

export function useSetPaused(): UseMutationResult<void, Error, PauseChange> {
  const client = useOpsClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ name, paused }: PauseChange) => client.setPaused(name, paused),
    onSettled: () => queryClient.invalidateQueries({ queryKey: JOBS_KEY })
  })
}

export function useRequeue(): UseMutationResult<number, Error, string | undefined> {
  const client = useOpsClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (failure: string | undefined) => client.requeue(failure),
    onSettled: () => queryClient.invalidateQueries({ queryKey: COLLECTION_KEY })
  })
}

type BatchKeyAddition = { label: string; key: string }

export function useAddBatchKey(): UseMutationResult<void, Error, BatchKeyAddition> {
  const client = useOpsClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ label, key }: BatchKeyAddition) => client.addBatchKey(label, key),
    onSettled: () => queryClient.invalidateQueries({ queryKey: BATCH_KEYS_KEY })
  })
}

type BatchKeyEnabledChange = { id: number; enabled: boolean }

export function useSetBatchKeyEnabled(): UseMutationResult<void, Error, BatchKeyEnabledChange> {
  const client = useOpsClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, enabled }: BatchKeyEnabledChange) => client.setBatchKeyEnabled(id, enabled),
    onSettled: () => queryClient.invalidateQueries({ queryKey: BATCH_KEYS_KEY })
  })
}

export function useDeleteBatchKey(): UseMutationResult<void, Error, number> {
  const client = useOpsClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => client.deleteBatchKey(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: BATCH_KEYS_KEY })
  })
}
