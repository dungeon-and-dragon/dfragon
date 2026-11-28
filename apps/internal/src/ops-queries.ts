import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult
} from '@tanstack/react-query'
import { createContext, use, useEffect, useRef } from 'react'
import type {
  ContentClearSettingChange,
  LabCandidateQuery,
  LabCurrencyDraft,
  LabItemDetailDraft,
  OpsClient
} from '#ops-api/ops-client'
import type { LabItemGroup } from '#ops-api/ops-schemas'

export const REFRESH_INTERVAL_MS = 1_000

const JOBS_KEY = ['jobs'] as const
const QUEUES_KEY = ['queues'] as const
const COLLECTION_KEY = ['collection'] as const
const BATCH_KEYS_KEY = ['batch-keys'] as const
const CONTENT_CLEAR_SETTINGS_KEY = ['content-clear-settings'] as const
const LAB_ITEMS_KEY = ['lab-items'] as const
const LAB_CURRENCIES_KEY = ['lab-currencies'] as const
const LAB_ITEM_DETAILS_KEY = ['lab-item-details'] as const
const LAB_CANDIDATES_KEY = ['lab-candidates'] as const
const LAB_CANDIDATE_EXCLUSIONS_KEY = [...LAB_CANDIDATES_KEY, 'exclusions'] as const

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

export function useRunHistory() {
  const client = useOpsClient()

  return useInfiniteQuery({
    queryKey: [...JOBS_KEY, 'runs'],
    queryFn: ({ pageParam }) => client.readRuns(pageParam),
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

export function useContentClearSettings() {
  const client = useOpsClient()

  return useQuery({
    queryKey: CONTENT_CLEAR_SETTINGS_KEY,
    queryFn: client.readContentClearSettings,
    refetchInterval: REFRESH_INTERVAL_MS
  })
}

// 소유자가 체크를 바꾸는 동안 목록이 바뀌지 않게 주기적으로 다시 읽지 않는다.
export function useLabItems() {
  const client = useOpsClient()

  return useQuery({ queryKey: LAB_ITEMS_KEY, queryFn: client.readLabItems })
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

export function useChangeContentClearSetting(): UseMutationResult<
  void,
  Error,
  ContentClearSettingChange
> {
  const client = useOpsClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: client.changeContentClearSetting,
    onSettled: () => queryClient.invalidateQueries({ queryKey: CONTENT_CLEAR_SETTINGS_KEY })
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

export function useReplaceLabItems(): UseMutationResult<void, Error, LabItemGroup> {
  const client = useOpsClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (group: LabItemGroup) => client.replaceLabItems(group),
    onSettled: () => queryClient.invalidateQueries({ queryKey: LAB_ITEMS_KEY })
  })
}

export function useLabCurrencies() {
  const client = useOpsClient()

  return useQuery({ queryKey: LAB_CURRENCIES_KEY, queryFn: client.readLabCurrencies })
}

export function useLabCurrencyIconUrl(): OpsClient['labCurrencyIconUrl'] {
  return useOpsClient().labCurrencyIconUrl
}

type LabCurrencyAddition = LabCurrencyDraft & { icon: string }

export function useAddLabCurrency(): UseMutationResult<void, Error, LabCurrencyAddition> {
  const client = useOpsClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ icon, ...currency }: LabCurrencyAddition) =>
      client.addLabCurrency(currency, icon),
    onSettled: () => queryClient.invalidateQueries({ queryKey: LAB_CURRENCIES_KEY })
  })
}

type LabCurrencyUpdate = LabCurrencyDraft & { id: number; icon: string | undefined }

export function useUpdateLabCurrency(): UseMutationResult<void, Error, LabCurrencyUpdate> {
  const client = useOpsClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, icon, ...currency }: LabCurrencyUpdate) =>
      client.updateLabCurrency(id, currency, icon),
    onSettled: () => queryClient.invalidateQueries({ queryKey: LAB_CURRENCIES_KEY })
  })
}

export function useLabItemDetails() {
  const client = useOpsClient()

  return useQuery({ queryKey: LAB_ITEM_DETAILS_KEY, queryFn: client.readLabItemDetails })
}

export function useLabItemIconUrl(): OpsClient['labItemIconUrl'] {
  return useOpsClient().labItemIconUrl
}

export function useSaveLabItemDetail(): UseMutationResult<void, Error, LabItemDetailDraft> {
  const client = useOpsClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (detail: LabItemDetailDraft) => client.saveLabItemDetail(detail),
    onSettled: () => queryClient.invalidateQueries({ queryKey: LAB_ITEM_DETAILS_KEY })
  })
}

export function useLabCandidates(query: LabCandidateQuery) {
  const client = useOpsClient()

  return useQuery({
    queryKey: [...LAB_CANDIDATES_KEY, query],
    queryFn: () => client.readLabCandidates(query)
  })
}

export function useLabCandidatePriceHistory(itemName: string) {
  const client = useOpsClient()

  return useQuery({
    queryKey: [...LAB_CANDIDATES_KEY, 'history', itemName],
    queryFn: () => client.readLabCandidatePriceHistory(itemName)
  })
}

export function useLabCandidateExclusions() {
  const client = useOpsClient()

  return useQuery({
    queryKey: LAB_CANDIDATE_EXCLUSIONS_KEY,
    queryFn: client.readLabCandidateExclusions
  })
}

export function useExcludeLabCandidate(): UseMutationResult<void, Error, string> {
  const client = useOpsClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (itemName: string) => client.excludeLabCandidate(itemName),
    onSettled: () => queryClient.invalidateQueries({ queryKey: LAB_CANDIDATES_KEY })
  })
}

export function useIncludeLabCandidate(): UseMutationResult<void, Error, string> {
  const client = useOpsClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (itemName: string) => client.includeLabCandidate(itemName),
    onSettled: () => queryClient.invalidateQueries({ queryKey: LAB_CANDIDATE_EXCLUSIONS_KEY })
  })
}

export function useLabCandidateIconUrl(): OpsClient['labCandidateIconUrl'] {
  return useOpsClient().labCandidateIconUrl
}

// 후보 가격 job이 새로 끝나면 최저가와 배지가 바뀌므로 후보를 다시 읽는다. 처음 읽은 실행은 이미 반영된 값이다.
// runId가 undefined면 job 목록을 아직 읽지 못한 것이고, null이면 끝난 실행이 없는 것이다.
export function useRefreshLabCandidatesAfterRun(runId: number | null | undefined): void {
  const queryClient = useQueryClient()
  const seenRunId = useRef<number | null | undefined>(undefined)

  useEffect(() => {
    if (runId === undefined) {
      return
    }

    const seen = seenRunId.current
    seenRunId.current = runId

    if (seen !== undefined && seen !== runId) {
      queryClient.invalidateQueries({ queryKey: LAB_CANDIDATES_KEY })
    }
  }, [runId, queryClient])
}
