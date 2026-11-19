import { useQueryClient } from '@tanstack/react-query'
import { type AdventureWeekly, adventureWeeklySchema } from '#entities/adventure-guild'
import { type LoadedResult, useLoadedResult } from '#shared/lib/useLoadedResult'
import { requestAdventureJson } from './adventure-request'

function weeklyKey(adventureName: string) {
  return ['adventure', adventureName, 'weekly'] as const
}

export function useAdventureWeekly(adventureName: string): LoadedResult<AdventureWeekly> {
  return useLoadedResult(weeklyKey(adventureName), async () =>
    requestAdventureJson(adventureName, '/weekly', adventureWeeklySchema)
  )
}

export function useRefreshAdventureWeekly(): (adventureName: string) => Promise<void> {
  const queryClient = useQueryClient()

  return (adventureName) =>
    queryClient.invalidateQueries({ queryKey: weeklyKey(adventureName), exact: true })
}
