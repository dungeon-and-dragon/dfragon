import { useInfiniteQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import {
  type AdventureTimelineItem,
  type AdventureTimelineKind,
  type AdventureTimelinePage,
  adventureTimelinePageSchema
} from '#entities/adventure-guild'
import type { LoadedResult } from '#shared/lib/useLoadedResult'
import { requestAdventureJson } from './adventure-request'

export type AdventureTimelinePages = Readonly<{
  items: readonly AdventureTimelineItem[]
  hasMore: boolean
  loadingMore: boolean
  moreError: string | null
  loadMore: () => void
}>

function requestTimeline(
  adventureName: string,
  kind: AdventureTimelineKind | undefined,
  before: string | undefined
): Promise<AdventureTimelinePage> {
  return requestAdventureJson(adventureName, '/timeline', adventureTimelinePageSchema, {
    searchParams: { ...(kind !== undefined && { kind }), ...(before !== undefined && { before }) }
  })
}

function messageOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function nextCursorOf(page: AdventureTimelinePage): string | undefined {
  if (page.nextCursor === null) {
    return undefined
  }

  return page.nextCursor
}

export function useAdventureTimeline(
  adventureName: string,
  kind: AdventureTimelineKind | undefined
): LoadedResult<AdventureTimelinePages> {
  const { data, error, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } =
    useInfiniteQuery({
      queryKey: ['adventure', adventureName, 'timeline', kind ?? null],
      queryFn: ({ pageParam }) => requestTimeline(adventureName, kind, pageParam),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: nextCursorOf
    })

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

  const items = data.pages.flatMap((page) => page.items)
  const moreError = isFetchNextPageError ? messageOf(error) : null

  return {
    status: 'success',
    value: { items, hasMore: hasNextPage, loadingMore: isFetchingNextPage, moreError, loadMore }
  }
}
