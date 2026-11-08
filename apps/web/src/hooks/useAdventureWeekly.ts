import { useQueryClient } from '@tanstack/react-query'
import type { AdventureWeekly } from '#core/adventure-guild/adventure-weekly'
import { useClientHost } from '../host/client-host'
import { type LoadedResult, useLoadedResult } from './useLoadedResult'

function weeklyKey(adventureName: string) {
  return ['adventure', adventureName, 'weekly'] as const
}

export function useAdventureWeekly(adventureName: string): LoadedResult<AdventureWeekly> {
  const { getAdventureWeekly } = useClientHost()

  return useLoadedResult(weeklyKey(adventureName), () => getAdventureWeekly(adventureName))
}

export function useRefreshAdventureWeekly(): (adventureName: string) => void {
  const queryClient = useQueryClient()

  return (adventureName) => {
    queryClient.resetQueries({ queryKey: weeklyKey(adventureName), exact: true })
  }
}
