import type { CharacterDetailView } from '#core/shared/search/character-detail-view'
import { useClientHost } from '../host/client-host'
import { useLoadedResult } from './useLoadedResult'

export type CharacterDetailResult =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'success'; detail: CharacterDetailView }>
  | Readonly<{ status: 'error'; message: string }>

export function useCharacterDetail(serverId: string, characterId: string): CharacterDetailResult {
  const { getCharacterDetail } = useClientHost()
  const result = useLoadedResult(['character', serverId, characterId, 'detail'], () =>
    getCharacterDetail({ serverId, characterId })
  )
  if (result.status !== 'success') {
    return result
  }

  return { status: 'success', detail: result.value }
}
