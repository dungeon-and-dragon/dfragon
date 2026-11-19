import { type QueryKey, useQueryClient } from '@tanstack/react-query'
import { type AdventureEquipment, adventureEquipmentSchema } from '#entities/adventure-guild'
import { type LoadedResult, useLoadedResult } from '#shared/lib/useLoadedResult'
import type { EquipmentSearch } from '#pages/weekly/equipment-search'
import { requestAdventureJson } from './adventure-request'

function adventureEquipmentKey(adventureName: string) {
  return ['adventure', adventureName, 'equipment'] as const
}

function equipmentKey(adventureName: string, { server, set }: EquipmentSearch) {
  return [...adventureEquipmentKey(adventureName), server ?? null, set ?? null] as const
}

function requestEquipment(
  adventureName: string,
  { server, set }: EquipmentSearch
): Promise<AdventureEquipment> {
  return requestAdventureJson(adventureName, '/equipment', adventureEquipmentSchema, {
    searchParams: { ...(server !== undefined && { server }), ...(set !== undefined && { set }) }
  })
}

// 서버, 세트 칩을 바꾸는 동안에는 같은 모험단의 앞선 응답을 그대로 보인다.
export function useAdventureEquipment(
  adventureName: string,
  search: EquipmentSearch
): LoadedResult<AdventureEquipment> {
  function sameAdventure(previousKey: QueryKey): boolean {
    return previousKey[1] === adventureName
  }

  return useLoadedResult(
    equipmentKey(adventureName, search),
    () => requestEquipment(adventureName, search),
    { keepPreviousWhile: sameAdventure }
  )
}

export function useRefreshAdventureEquipment(): (adventureName: string) => Promise<void> {
  const queryClient = useQueryClient()

  return (adventureName) =>
    queryClient.invalidateQueries({ queryKey: adventureEquipmentKey(adventureName) })
}
