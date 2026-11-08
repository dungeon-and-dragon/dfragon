import type { CharacterDetailView } from '@dfragon/client-core/shared/search/character-detail-view'
import type { CharacterTimeline } from '@dfragon/client-core/shared/search/character-timeline'
import { useClientHost } from '../host/client-host'
import { useLoadedResult } from './useLoadedResult'

export type CharacterTimelineResult =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'success'; timeline: CharacterTimeline }>
  | Readonly<{ status: 'error'; message: string }>

export function useCharacterTimeline(detail: CharacterDetailView): CharacterTimelineResult {
  const { getCharacterTimeline } = useClientHost()
  const { serverId, characterId } = detail.character
  const result = useLoadedResult(['character', serverId, characterId, 'timeline'], () =>
    getCharacterTimeline({ serverId, characterId })
  )
  if (result.status !== 'success') {
    return result
  }

  return { status: 'success', timeline: result.value }
}
