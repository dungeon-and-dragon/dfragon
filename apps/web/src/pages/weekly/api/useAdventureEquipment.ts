import { useQueryClient } from '@tanstack/react-query'
import { type AdventureEquipment, adventureEquipmentSchema } from '#entities/adventure-guild'
import { type LoadedResult, useLoadedResult } from '#shared/lib/useLoadedResult'
import { requestAdventureJson } from './adventure-request'

function equipmentKey(adventureName: string) {
  return ['adventure', adventureName, 'equipment'] as const
}

export function useAdventureEquipment(adventureName: string): LoadedResult<AdventureEquipment> {
  return useLoadedResult(equipmentKey(adventureName), async () =>
    requestAdventureJson(adventureName, '/equipment', adventureEquipmentSchema)
  )
}

export function useRefreshAdventureEquipment(): (adventureName: string) => Promise<void> {
  const queryClient = useQueryClient()

  return (adventureName) =>
    queryClient.invalidateQueries({ queryKey: equipmentKey(adventureName), exact: true })
}
