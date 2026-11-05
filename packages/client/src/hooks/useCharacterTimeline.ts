import { useEffect, useState } from 'react'
import type { CharacterDetailView } from '@dfragon/client-core/shared/search/character-detail-view'
import type { CharacterTimeline } from '@dfragon/client-core/shared/search/character-timeline'
import { type ClientHost, useClientHost } from './useClientHost'

export type CharacterTimelineResult =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'success'; timeline: CharacterTimeline }>
  | Readonly<{ status: 'error'; message: string }>

const LOADING: CharacterTimelineResult = { status: 'loading' }

// 탭 패널은 숨기면 내용을 unmount하므로 요청을 상세 응답에 묶어 둔다. 상세를 다시 받기 전까지는 탭을 다시 열어도
// 조회하지 않는다. 실패한 요청은 지워 다음에 탭을 열 때 다시 조회한다.
const requests = new WeakMap<CharacterDetailView, Promise<CharacterTimeline>>()

function requestTimeline(
  detail: CharacterDetailView,
  getCharacterTimeline: ClientHost['getCharacterTimeline']
): Promise<CharacterTimeline> {
  const saved = requests.get(detail)
  if (saved !== undefined) {
    return saved
  }
  const { serverId, characterId } = detail.character
  const request = getCharacterTimeline({ serverId, characterId })
  requests.set(detail, request)
  request.catch(() => requests.delete(detail))

  return request
}

export function useCharacterTimeline(detail: CharacterDetailView): CharacterTimelineResult {
  const { getCharacterTimeline } = useClientHost()
  const [received, setReceived] = useState<{
    detail: CharacterDetailView
    result: CharacterTimelineResult
  } | null>(null)

  useEffect(() => {
    let active = true
    const settle = (result: CharacterTimelineResult) => {
      // 다른 캐릭터로 바뀐 뒤 늦게 온 응답이 지금 캐릭터의 값을 덮지 않게 한다.
      if (active) {
        setReceived({ detail, result })
      }
    }
    requestTimeline(detail, getCharacterTimeline).then(
      (timeline) => settle({ status: 'success', timeline }),
      (error: unknown) =>
        settle({ status: 'error', message: error instanceof Error ? error.message : String(error) })
    )

    return () => {
      active = false
    }
  }, [getCharacterTimeline, detail])

  if (received?.detail !== detail) {
    return LOADING
  }

  return received.result
}
