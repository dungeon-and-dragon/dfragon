import { useEffect, useState } from 'react'
import type { CharacterDetailView } from '@dfragon/client-core/shared/search/character-detail-view'
import { useClientHost } from './useClientHost'

export type CharacterDetailResult =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'success'; detail: CharacterDetailView }>
  | Readonly<{ status: 'error'; message: string }>

const LOADING: CharacterDetailResult = { status: 'loading' }

export function useCharacterDetail(serverId: string, characterId: string): CharacterDetailResult {
  const { getCharacterDetail } = useClientHost()
  const [received, setReceived] = useState<{
    serverId: string
    characterId: string
    result: CharacterDetailResult
  } | null>(null)

  useEffect(() => {
    let active = true
    const settle = (result: CharacterDetailResult) => {
      // 다른 캐릭터로 바뀐 뒤 늦게 온 응답이 지금 캐릭터의 값을 덮지 않게 한다.
      if (active) {
        setReceived({ serverId, characterId, result })
      }
    }
    getCharacterDetail({ serverId, characterId }).then(
      (detail) => settle({ status: 'success', detail }),
      (error: unknown) =>
        settle({ status: 'error', message: error instanceof Error ? error.message : String(error) })
    )

    return () => {
      active = false
    }
  }, [getCharacterDetail, serverId, characterId])

  if (received?.serverId !== serverId || received.characterId !== characterId) {
    return LOADING
  }

  return received.result
}
