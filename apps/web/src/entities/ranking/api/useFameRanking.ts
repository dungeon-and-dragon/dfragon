import { useInfiniteQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import { SearchHttpFailure } from '#shared/api/api-error'
import { createJsonRequest } from '#shared/api/json-request'
import {
  type FameRanking,
  type FameRankingFilter,
  fameRankingSchema,
  ITEM_FILTER_LIMIT,
  type RankedCharacter
} from '#core/ranking'
import { API_BASE_URL, dfragonHttp } from '#shared/api/dfragon-api'
import type { LoadedResult } from '#shared/lib/useLoadedResult'

const FAME_RANKING_PATH = '/rankings/fame'

export type FameRankingPages = Readonly<{
  characters: readonly RankedCharacter[]
  hasMore: boolean
  loadingMore: boolean
  moreError: string | null
  loadMore: () => void
}>

const requestJson = createJsonRequest(dfragonHttp, API_BASE_URL)

// API는 빈 항목, 중복, 여섯 개 이상을 400으로 거부하므로 보내기 전에 거른다.
function itemIdsParam(itemIds: readonly string[] | undefined): string | undefined {
  if (itemIds === undefined || itemIds.length === 0) {
    return undefined
  }

  const valid =
    itemIds.length <= ITEM_FILTER_LIMIT &&
    itemIds.every((itemId) => itemId.length > 0 && !itemId.includes(',')) &&
    new Set(itemIds).size === itemIds.length

  if (!valid) {
    throw new SearchHttpFailure('INVALID_SEARCH_QUERY')
  }

  return itemIds.join(',')
}

async function requestFameRanking(
  filter: FameRankingFilter,
  cursor: string | undefined
): Promise<FameRanking> {
  if (
    (filter.jobGrowId !== undefined && filter.jobId === undefined) ||
    (filter.oathSetOption !== undefined && filter.oathSetId === undefined) ||
    (filter.fameFrom !== undefined &&
      filter.fameTo !== undefined &&
      filter.fameFrom > filter.fameTo)
  ) {
    throw new SearchHttpFailure('INVALID_SEARCH_QUERY')
  }

  const oathSetId = filter.oathSetId !== undefined ? String(filter.oathSetId) : undefined
  const itemIds = itemIdsParam(filter.itemIds)
  const fameFrom = filter.fameFrom !== undefined ? String(filter.fameFrom) : undefined
  const fameTo = filter.fameTo !== undefined ? String(filter.fameTo) : undefined

  return requestJson(FAME_RANKING_PATH, fameRankingSchema, {
    searchParams: {
      ...(filter.jobId !== undefined && { jobId: filter.jobId }),
      ...(filter.jobGrowId !== undefined && { jobGrowId: filter.jobGrowId }),
      ...(filter.role !== undefined && { role: filter.role }),
      ...(filter.equipmentSetId !== undefined && { equipmentSetId: filter.equipmentSetId }),
      ...(oathSetId !== undefined && { oathSetId }),
      ...(filter.oathSetOption !== undefined && { oathSetOption: filter.oathSetOption }),
      ...(itemIds !== undefined && { itemIds }),
      ...(fameFrom !== undefined && { fameFrom }),
      ...(fameTo !== undefined && { fameTo }),
      ...(cursor !== undefined && { cursor })
    }
  })
}

function messageOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function nextCursorOf(page: FameRanking): string | undefined {
  if (page.nextCursor === null) {
    return undefined
  }

  return page.nextCursor
}

export function useFameRanking(filter: FameRankingFilter): LoadedResult<FameRankingPages> {
  const query = useInfiniteQuery({
    queryKey: [
      'fame-ranking',
      filter.jobId ?? null,
      filter.jobGrowId ?? null,
      filter.role ?? null,
      filter.equipmentSetId ?? null,
      filter.oathSetId ?? null,
      filter.oathSetOption ?? null,
      filter.itemIds?.join(',') ?? null,
      filter.fameFrom ?? null,
      filter.fameTo ?? null
    ],
    queryFn: ({ pageParam }) => requestFameRanking(filter, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursorOf
  })
  const { data, error, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } =
    query
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])
  if (data === undefined) {
    if (error != null) {
      return { status: 'error', message: messageOf(error) }
    }

    return { status: 'loading' }
  }

  const characters = data.pages.flatMap((page) => page.characters)
  const moreError = isFetchNextPageError ? messageOf(error) : null

  return {
    status: 'success',
    value: {
      characters,
      hasMore: hasNextPage,
      loadingMore: isFetchingNextPage,
      moreError,
      loadMore
    }
  }
}
