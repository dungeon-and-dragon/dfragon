import { useInfiniteQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import type { FameRanking, FameRankingFilter, RankedCharacter } from '#core/ranking'
import { useClientHost } from '#host/client-host'
import type { LoadedResult } from '#shared/lib/useLoadedResult'

export type FameRankingPages = Readonly<{
  characters: readonly RankedCharacter[]
  hasMore: boolean
  loadingMore: boolean
  moreError: string | null
  loadMore: () => void
}>

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
  const { getFameRanking } = useClientHost()
  const query = useInfiniteQuery({
    queryKey: [
      'fame-ranking',
      filter.jobId ?? null,
      filter.jobGrowId ?? null,
      filter.role ?? null,
      filter.equipmentSetId ?? null,
      filter.oathSetId ?? null,
      filter.oathSetOption ?? null,
      filter.itemIds?.join(',') ?? null
    ],
    queryFn: ({ pageParam }) => getFameRanking(filter, pageParam),
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
