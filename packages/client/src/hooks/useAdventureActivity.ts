import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AdventureActivity } from '@dfragon/client-core/shared/adventure-guild/adventure-activity'
import { useClientHost } from './useClientHost'

export type AdventureActivityResult =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'success'; value: AdventureActivity; previous: boolean }>
  | Readonly<{ status: 'error'; message: string }>

const LOADING = { status: 'loading' } as const

function activityKey(adventureName: string) {
  return ['adventure', adventureName, 'activity'] as const
}

// 시즌을 바꾸는 동안 시즌 목록을 계속 그리도록 새 시즌을 받기 전까지 앞서 받은 응답을 previous로 돌려준다.
export function useAdventureActivity(
  adventureName: string,
  season: number | undefined
): AdventureActivityResult {
  const { getAdventureActivity } = useClientHost()
  const { data, error, isPlaceholderData } = useQuery({
    queryKey: [...activityKey(adventureName), season ?? null],
    queryFn: () => getAdventureActivity(adventureName, season),
    placeholderData: keepPreviousData
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

export function useRefreshAdventureActivity(): (adventureName: string) => void {
  const queryClient = useQueryClient()

  return (adventureName) => {
    queryClient.resetQueries({ queryKey: activityKey(adventureName) })
  }
}
