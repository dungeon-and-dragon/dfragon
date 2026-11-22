import { infiniteQueryOptions, useInfiniteQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import { SearchHttpFailure } from '#shared/api/api-error'
import { createJsonRequest } from '#shared/api/json-request'
import {
  type FameRanking,
  type FameRankingFilter,
  fameRankingSchema,
  type RankedCharacter,
  type SkillEvolutionChoice,
  evolutionsQueryText
} from '#entities/ranking/model/ranking-stats'
import { EVOLUTION_FILTER_LIMIT, ITEM_FILTER_LIMIT } from '#shared/config/ranking'
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

// API는 전직 없이, 5쌍을 넘게, 같은 스킬을 두 번, 구분자가 든 이름을 400으로 거부하므로 보내기 전에 거른다.
function evolutionsParam(
  evolutions: readonly SkillEvolutionChoice[] | undefined,
  jobGrowId: string | undefined
): string | undefined {
  if (evolutions === undefined || evolutions.length === 0) {
    return undefined
  }

  const names = evolutions.map(({ name }) => name)
  const valid =
    jobGrowId !== undefined &&
    evolutions.length <= EVOLUTION_FILTER_LIMIT &&
    names.every((name) => name.length > 0 && !name.includes(',') && !name.includes('~')) &&
    new Set(names).size === names.length

  if (!valid) {
    throw new SearchHttpFailure('INVALID_SEARCH_QUERY')
  }

  return evolutionsQueryText(evolutions)
}

function evolutionsKey(evolutions: readonly SkillEvolutionChoice[] | undefined): string | null {
  if (evolutions === undefined) {
    return null
  }

  return evolutionsQueryText(evolutions)
}

function isReversed(from: number | undefined, to: number | undefined): boolean {
  return from !== undefined && to !== undefined && from > to
}

// API는 기준과 맞지 않는 범위와 거꾸로 된 범위를 400으로 거부하므로 보내기 전에 거른다.
async function requestFameRanking(
  filter: FameRankingFilter,
  cursor: string | undefined
): Promise<FameRanking> {
  const scored = filter.sort !== undefined
  if (
    (filter.jobGrowId !== undefined && filter.jobId === undefined) ||
    (filter.oathSetOption !== undefined && filter.oathSetId === undefined) ||
    isReversed(filter.fameFrom, filter.fameTo) ||
    isReversed(filter.scoreFrom, filter.scoreTo) ||
    (scored && (filter.fameFrom !== undefined || filter.fameTo !== undefined)) ||
    (!scored && (filter.scoreFrom !== undefined || filter.scoreTo !== undefined))
  ) {
    throw new SearchHttpFailure('INVALID_SEARCH_QUERY')
  }

  const oathSetId = filter.oathSetId !== undefined ? String(filter.oathSetId) : undefined
  const itemIds = itemIdsParam(filter.itemIds)
  const evolutions = evolutionsParam(filter.evolutions, filter.jobGrowId)
  const fameFrom = filter.fameFrom !== undefined ? String(filter.fameFrom) : undefined
  const fameTo = filter.fameTo !== undefined ? String(filter.fameTo) : undefined
  const scoreFrom = filter.scoreFrom !== undefined ? String(filter.scoreFrom) : undefined
  const scoreTo = filter.scoreTo !== undefined ? String(filter.scoreTo) : undefined

  return requestJson(FAME_RANKING_PATH, fameRankingSchema, {
    searchParams: {
      ...(filter.jobId !== undefined && { jobId: filter.jobId }),
      ...(filter.jobGrowId !== undefined && { jobGrowId: filter.jobGrowId }),
      ...(filter.role !== undefined && { role: filter.role }),
      ...(filter.equipmentSetId !== undefined && { equipmentSetId: filter.equipmentSetId }),
      ...(oathSetId !== undefined && { oathSetId }),
      ...(filter.oathSetOption !== undefined && { oathSetOption: filter.oathSetOption }),
      ...(itemIds !== undefined && { itemIds }),
      ...(evolutions !== undefined && { evolutions }),
      ...(fameFrom !== undefined && { fameFrom }),
      ...(fameTo !== undefined && { fameTo }),
      ...(filter.sort !== undefined && { sort: filter.sort }),
      ...(scoreFrom !== undefined && { scoreFrom }),
      ...(scoreTo !== undefined && { scoreTo }),
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

// 서버가 화면을 그리기 전에 받아 둘 때와 화면의 hook이 같은 key와 요청을 쓴다.
export function fameRankingQuery(filter: FameRankingFilter) {
  return infiniteQueryOptions({
    queryKey: [
      'fame-ranking',
      filter.jobId ?? null,
      filter.jobGrowId ?? null,
      filter.role ?? null,
      filter.equipmentSetId ?? null,
      filter.oathSetId ?? null,
      filter.oathSetOption ?? null,
      filter.itemIds?.join(',') ?? null,
      evolutionsKey(filter.evolutions),
      filter.fameFrom ?? null,
      filter.fameTo ?? null,
      filter.sort ?? null,
      filter.scoreFrom ?? null,
      filter.scoreTo ?? null
    ],
    queryFn: ({ pageParam }) => requestFameRanking(filter, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursorOf
  })
}

export function useFameRanking(filter: FameRankingFilter): LoadedResult<FameRankingPages> {
  const query = useInfiniteQuery(fameRankingQuery(filter))
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
