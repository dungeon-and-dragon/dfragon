import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CharacterDetailView, CharacterIdentity } from '#entities/character'
import { useLoadedResult } from '#shared/lib/useLoadedResult'
import { detailViewSchemaOf, requestCharacterJson } from './character-api'

export type CharacterDetailResult =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'success'; detail: CharacterDetailView }>
  | Readonly<{ status: 'error'; message: string }>

function detailKey({ serverId, characterId }: CharacterIdentity) {
  return ['character', serverId, characterId, 'detail']
}

function requestCharacterDetail(identity: CharacterIdentity): Promise<CharacterDetailView> {
  return requestCharacterJson(identity, '', detailViewSchemaOf(identity))
}

function requestCharacterRefresh(identity: CharacterIdentity): Promise<CharacterDetailView> {
  return requestCharacterJson(identity, '/refresh', detailViewSchemaOf(identity), {
    method: 'post'
  })
}

export function useCharacterDetail(serverId: string, characterId: string): CharacterDetailResult {
  const result = useLoadedResult(detailKey({ serverId, characterId }), () =>
    requestCharacterDetail({ serverId, characterId })
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
  const queryClient = useQueryClient()
  const { mutate, isPending } = useMutation({
    mutationFn: requestCharacterRefresh,
    // 받는 중에 다른 캐릭터로 옮겨도 요청한 캐릭터의 캐시만 바꾸도록 지금 화면이 아닌 요청의 key에 넣는다.
    onSuccess(detail, identity) {
      queryClient.setQueryData(detailKey(identity), detail)
    }
  })

  return { refresh: mutate, refreshing: isPending }
}
