import { type QueryClient, useQueries, useQueryClient } from '@tanstack/react-query'
import type { CharacterIdentity } from '#entities/character'
import { requestCharacterJson } from '#entities/character-detail'
import {
  type EpicSoulRecovery,
  recoverySchema
} from '#pages/lab-epic-souls/model/epic-soul-recovery'

// 한 캐릭터에 엔진을 세트 13 × 무기 계열 2번 돌려 ky 기본 10초보다 오래 걸릴 수 있다.
const RECOVERY_TIMEOUT_MS = 60_000

// 점수 엔진 worker가 하나라 한꺼번에 보내도 빨리 끝나지 않고, 뒤 요청이 기다리다 timeout에 걸리므로 하나씩 보낸다.
const lastRecoveries = new WeakMap<QueryClient, Promise<unknown>>()

export type EpicSoulRecoveryResult =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'success'; recovery: EpicSoulRecovery }>
  | Readonly<{ status: 'error' }>

function recoveryKey({ serverId, characterId }: CharacterIdentity, includePrimordial: boolean) {
  return ['character', serverId, characterId, 'epic-soul-recovery', includePrimordial] as const
}

function requestRecovery(
  queryClient: QueryClient,
  identity: CharacterIdentity,
  includePrimordial: boolean
): Promise<EpicSoulRecovery> {
  const last = lastRecoveries.get(queryClient) ?? Promise.resolve()
  const request = last.then(() =>
    requestCharacterJson(identity, '/epic-soul-recovery', recoverySchema, {
      method: 'post',
      json: { includePrimordial },
      timeout: RECOVERY_TIMEOUT_MS
    })
  )

  // 앞 캐릭터의 실패는 그 줄의 query가 받고, 다음 요청은 실패와 상관없이 이어서 보낸다.
  lastRecoveries.set(
    queryClient,
    request.catch(() => undefined)
  )

  return request
}

/** 목록 순서대로 하나씩 받고, 받는 대로 그 줄을 채운다. 한 줄이 실패해도 다음 줄을 받는다. */
export function useEpicSoulRecoveries(
  characters: readonly CharacterIdentity[],
  includePrimordial: boolean
): EpicSoulRecoveryResult[] {
  const queryClient = useQueryClient()
  const queries = characters.map((identity) => {
    const queryKey = recoveryKey(identity, includePrimordial)

    return {
      queryKey,
      queryFn: () => requestRecovery(queryClient, identity, includePrimordial)
    }
  })

  return useQueries({
    queries,
    combine: (results) =>
      results.map(({ data, isError }): EpicSoulRecoveryResult => {
        if (data !== undefined) {
          return { status: 'success', recovery: data }
        }

        if (isError) {
          return { status: 'error' }
        }

        return { status: 'loading' }
      })
  })
}
