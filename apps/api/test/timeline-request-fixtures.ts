import type {
  TimelineCharacter,
  TimelineSyncRequest,
  TimelineSyncStateRow
} from '@dfragon/database'
import type { TimelineSyncRequestRepository } from '../src/application/character-timeline/repository.js'

export const requestKey = ({ kind, serverId, characterId, seasonId }: TimelineSyncRequest) =>
  `${kind}/${serverId}/${characterId}/${seasonId}`

// 요청 테이블과 동기화 상태를 메모리에 흉내 낸 fake이며 DB를 쓰지 않는다. 행을 지우는 worker는 테스트가 remove로 흉내 낸다.
export function memoryTimelineRequests(states: readonly TimelineSyncStateRow[] = []) {
  const rows = new Map<string, TimelineSyncRequest & { awaited: boolean }>()
  const inserted: (TimelineSyncRequest & { awaited: boolean })[] = []
  const repository: TimelineSyncRequestRepository = {
    readStates: async (characters) =>
      states.filter((state) =>
        characters.some(
          ({ serverId, characterId }) =>
            state.serverId === serverId && state.characterId === characterId
        )
      ),
    request: async (requests, { awaited }) => {
      for (const request of requests) {
        const existing = rows.get(requestKey(request))
        const row = { ...request, awaited: awaited || existing?.awaited === true }

        rows.set(requestKey(request), row)
        inserted.push({ ...request, awaited })
      }
    },
    has: async (request) => rows.has(requestKey(request)),
    readSeasonBackfillSeasons: async (characters) => [
      ...new Set(
        [...rows.values()]
          .filter(
            (row) =>
              row.kind === 'season-backfill' &&
              characters.some(
                ({ serverId, characterId }) =>
                  row.serverId === serverId && row.characterId === characterId
              )
          )
          .map(({ seasonId }) => seasonId)
      )
    ]
  }

  return {
    repository,
    inserted,
    keys: () => [...rows.keys()],
    remove: (request: TimelineSyncRequest) => {
      rows.delete(requestKey(request))
    }
  }
}

// 넣은 정기 동기화 요청의 캐릭터를 넣은 순서대로 onSync에 알리는 fake다. 다른 종류는 넣기만 하고 행은 남기지 않는다.
export function syncRequestRecorder(
  onSync: (character: TimelineCharacter) => unknown
): TimelineSyncRequestRepository {
  return {
    readStates: async () => [],
    request: async (requests) => {
      for (const { kind, serverId, characterId } of requests) {
        if (kind === 'sync') {
          onSync({ serverId, characterId })
        }
      }
    },
    has: async () => false,
    readSeasonBackfillSeasons: async () => []
  }
}
