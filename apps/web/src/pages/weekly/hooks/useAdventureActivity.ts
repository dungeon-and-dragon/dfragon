import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  ActivitySeason,
  AdventureActivity,
  AdventureActivityDay
} from '#core/adventure-guild/adventure-activity'
import { useClientHost } from '../../../host/client-host'

export type AdventureActivityResult =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'success'; value: AdventureActivity; previous: boolean }>
  | Readonly<{ status: 'error'; message: string }>

const LOADING = { status: 'loading' } as const
const BACKFILL_POLL_MS = 3000

function activityKey(adventureName: string) {
  return ['adventure', adventureName, 'activity'] as const
}

function seasonsActivityKey(adventureName: string) {
  return [...activityKey(adventureName), 'seasons'] as const
}

function seasonActivityKey(adventureName: string, season: number | undefined) {
  const seasonKey = season ?? null

  return [...seasonsActivityKey(adventureName), seasonKey] as const
}

function seasonDaysKey(adventureName: string, season: number) {
  return [...activityKey(adventureName), 'days', season] as const
}

function backfillRunning({ seasons }: AdventureActivity): boolean {
  return seasons.some(({ backfill }) => backfill?.running === true)
}

function finishedBackfills(
  previous: AdventureActivity | undefined,
  next: AdventureActivity
): number[] {
  const running = new Set(
    previous?.seasons.filter(({ backfill }) => backfill?.running === true).map(({ id }) => id)
  )

  return next.seasons
    .filter(({ id, backfill }) => running.has(id) && backfill?.running !== true)
    .map(({ id }) => id)
}

// 시즌을 바꾸는 동안 시즌 목록을 계속 그리도록 새 시즌을 받기 전까지 앞서 받은 응답을 previous로 돌려준다.
export function useAdventureActivity(
  adventureName: string,
  season: number | undefined
): AdventureActivityResult {
  const { getAdventureActivity } = useClientHost()
  const queryClient = useQueryClient()
  const { data, error, isPlaceholderData } = useQuery({
    queryKey: seasonActivityKey(adventureName, season),
    queryFn: async () => {
      const activity = await getAdventureActivity(adventureName, season)
      const currentQuery = queryClient.getQueryCache().find({
        queryKey: seasonActivityKey(adventureName, season),
        exact: true
      })

      // 받는 동안 받은 시즌 하루 상세는 비어 있으므로, 받기가 끝난 응답에서 한 번만 다시 받는다.
      const previous = queryClient.getQueryData<AdventureActivity>(
        seasonActivityKey(adventureName, season)
      )
      for (const finished of finishedBackfills(previous, activity)) {
        queryClient.invalidateQueries({ queryKey: seasonDaysKey(adventureName, finished) })
      }

      // 진행 조회는 고른 시즌만 하므로, 받는 동안 열었던 다른 시즌 캐시에는 옛 받기 상태가 남는다.
      // 새 응답의 시즌 목록을 다른 캐시에도 넣어 시즌을 바꿀 때 이전 진행 상태로 돌아가지 않게 한다.
      queryClient.setQueriesData<AdventureActivity>(
        {
          queryKey: seasonsActivityKey(adventureName),
          predicate: (query) => query !== currentQuery
        },
        (cached) => {
          if (cached === undefined) {
            return cached
          }

          return { ...cached, seasons: activity.seasons }
        }
      )

      return activity
    },
    placeholderData: keepPreviousData,
    refetchInterval: ({ state }) => {
      if (state.data !== undefined && backfillRunning(state.data)) {
        return BACKFILL_POLL_MS
      }

      return false
    }
  })
  if (data !== undefined) {
    return { status: 'success', value: data, previous: isPlaceholderData }
  }

  if (error != null) {
    const message = error instanceof Error ? error.message : String(error)

    return { status: 'error', message }
  }

  return LOADING
}

// 받기 요청이 돌려준 시즌 상태를 받아 둔 모든 시즌 응답에 바로 넣어, 받는 중이면 다음 조회를 기다리지 않고 진행 조회를 시작한다.
// 받는 중에 받아 둔 다른 시즌으로 바꿔도 그 응답이 받는 중을 알아야 진행 조회가 이어진다.
export function useBackfillAdventureSeason(adventureName: string): (seasonId: number) => void {
  const { backfillAdventureSeason } = useClientHost()
  const queryClient = useQueryClient()
  const { mutate } = useMutation({
    mutationFn: (seasonId: number) => backfillAdventureSeason(adventureName, seasonId),
    onSuccess(updated: ActivitySeason) {
      queryClient.setQueriesData<AdventureActivity>(
        { queryKey: seasonsActivityKey(adventureName) },
        (activity) => {
          if (activity === undefined) {
            return activity
          }

          const seasons = activity.seasons.map((entry) =>
            entry.id === updated.id ? updated : entry
          )

          return { ...activity, seasons }
        }
      )
    }
  })

  return mutate
}

export type AdventureActivitySeasonDaysResult =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'success'; value: readonly AdventureActivityDay[] }>
  | Readonly<{ status: 'error'; message: string }>

export function useAdventureActivitySeasonDays(
  adventureName: string,
  season: number
): AdventureActivitySeasonDaysResult {
  const { getAdventureActivitySeasonDays } = useClientHost()
  const { data, error } = useQuery({
    queryKey: seasonDaysKey(adventureName, season),
    queryFn: () => getAdventureActivitySeasonDays(adventureName, season)
  })
  if (data !== undefined) {
    return { status: 'success', value: data.days }
  }

  if (error != null) {
    const message = error instanceof Error ? error.message : String(error)

    return { status: 'error', message }
  }

  return LOADING
}

export function useRefreshAdventureActivity(): (adventureName: string) => Promise<void> {
  const queryClient = useQueryClient()

  return (adventureName) => queryClient.invalidateQueries({ queryKey: activityKey(adventureName) })
}
