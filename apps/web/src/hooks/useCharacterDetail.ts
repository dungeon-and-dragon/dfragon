import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CharacterIdentity } from '#core/character/character'
import type { CharacterDetailView } from '#core/character/character-detail-view'
import { useClientHost } from '../host/client-host'
import { useLoadedResult } from './useLoadedResult'

export type CharacterDetailResult =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'success'; detail: CharacterDetailView }>
  | Readonly<{ status: 'error'; message: string }>

function detailKey({ serverId, characterId }: CharacterIdentity) {
  return ['character', serverId, characterId, 'detail']
}

export function useCharacterDetail(serverId: string, characterId: string): CharacterDetailResult {
  const { getCharacterDetail } = useClientHost()
  const result = useLoadedResult(detailKey({ serverId, characterId }), () =>
    getCharacterDetail({ serverId, characterId })
  )
  if (result.status !== 'success') {
    return result
  }

  return { status: 'success', detail: result.value }
}

export function useRefreshCharacterDetail(): Readonly<{
  refresh: (identity: CharacterIdentity) => void
  refreshing: boolean
}> {
  const { refreshCharacterDetail } = useClientHost()
  const queryClient = useQueryClient()
  const { mutate, isPending } = useMutation({
    mutationFn: (identity: CharacterIdentity) => refreshCharacterDetail(identity),
    // 받는 중에 다른 캐릭터로 옮겨도 요청한 캐릭터의 캐시만 바꾸도록 지금 화면이 아닌 요청의 key에 넣는다.
    onSuccess(detail, identity) {
      queryClient.setQueryData(detailKey(identity), detail)
    }
  })

  return { refresh: mutate, refreshing: isPending }
}
