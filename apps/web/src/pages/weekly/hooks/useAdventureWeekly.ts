import { useQueryClient } from '@tanstack/react-query'
import type { AdventureWeekly } from '#core/adventure-guild'
import { useClientHost } from '#host/client-host'
import { type LoadedResult, useLoadedResult } from '#shared/lib/useLoadedResult'

function weeklyKey(adventureName: string) {
  return ['adventure', adventureName, 'weekly'] as const
}

export function useAdventureWeekly(adventureName: string): LoadedResult<AdventureWeekly> {
  const { getAdventureWeekly } = useClientHost()

  return useLoadedResult(weeklyKey(adventureName), () => getAdventureWeekly(adventureName))
}

export function useRefreshAdventureWeekly(): (adventureName: string) => Promise<void> {
  const queryClient = useQueryClient()

  return (adventureName) =>
    queryClient.invalidateQueries({ queryKey: weeklyKey(adventureName), exact: true })
}
