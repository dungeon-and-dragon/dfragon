import { useQueries } from '@tanstack/react-query'
import type { CharacterIdentity } from '#entities/character'
import { requestCharacterJson } from '#entities/character-detail'
import { type EpicSouls, epicSoulsSchema } from '#pages/lab-epic-souls/model/epic-soul-recovery'

export type EpicSoulRecoveryResult =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'success'; souls: EpicSouls }>
  | Readonly<{ status: 'error' }>

function recoveryKey({ serverId, characterId }: CharacterIdentity) {
  return ['character', serverId, characterId, 'epic-soul-recovery'] as const
}

/** 줄마다 따로 받아 받는 대로 채운다. 한 줄이 실패해도 다른 줄은 그대로 받는다. */
export function useEpicSoulRecoveries(
  characters: readonly CharacterIdentity[]
): EpicSoulRecoveryResult[] {
  const queries = characters.map((identity) => ({
    queryKey: recoveryKey(identity),
    queryFn: () => requestCharacterJson(identity, '/epic-soul-recovery', epicSoulsSchema)
  }))

  return useQueries({
    queries,
    combine: (results) =>
      results.map(({ data, isError }): EpicSoulRecoveryResult => {
        if (data !== undefined) {
          return { status: 'success', souls: data }
        }

        if (isError) {
          return { status: 'error' }
        }

        return { status: 'loading' }
      })
  })
}
