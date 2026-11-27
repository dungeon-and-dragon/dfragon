import type { TimelineCharacter, TimelineSyncRequest } from '@dfragon/database'
import {
  isEnhancementBackfilled,
  isSyncedRecently
} from '@dfragon/server-core/application/character-timeline/index.js'
import type { SeasonBackfillJob } from '@dfragon/server-core/domain/character-timeline/index.js'
import type { TimelineSyncRequestRepository } from './repository.js'

const characterKey = ({ serverId, characterId }: TimelineCharacter) => `${serverId}/${characterId}`

const syncRequest = ({ serverId, characterId }: TimelineCharacter): TimelineSyncRequest => ({
  kind: 'sync',
  serverId,
  characterId,
  seasonId: 0
})

// 상세 조회와 모험단 화면이 부르며 넣기를 기다리지 않는다. 넣기가 실패하면 부르는 쪽이 아니라 넣는 쪽이 알린다.
export type RequestTimelineSync = (characters: readonly TimelineCharacter[]) => void

export type TimelineSyncRequestPorts = {
  now: () => Date
}

export class TimelineSyncRequestService {
  constructor(
    private readonly repository: TimelineSyncRequestRepository,
    private readonly ports: TimelineSyncRequestPorts
  ) {}

  // worker가 받아도 Neople을 부르지 않고 끝날 요청은 넣지 않는다. 판정은 worker의 동기화, 백필과 같다.
  async request(
    characters: readonly TimelineCharacter[],
    { enhancementBackfill }: { enhancementBackfill: boolean }
  ): Promise<void> {
    if (characters.length === 0) {
      return
    }

    const states = new Map(
      (await this.repository.readStates(characters)).map((state) => [characterKey(state), state])
    )
    const now = this.ports.now()
    const requests: TimelineSyncRequest[] = []

    for (const character of characters) {
      const state = states.get(characterKey(character))

      if (!isSyncedRecently(state, now)) {
        requests.push(syncRequest(character))
      }

      if (
        enhancementBackfill &&
        !isEnhancementBackfilled(state?.enhancementBackfilledUntil ?? null)
      ) {
        requests.push({ ...syncRequest(character), kind: 'enhancement-backfill' })
      }
    }

    if (requests.length > 0) {
      await this.repository.request(requests)
    }
  }

  async requestSeasonBackfill(jobs: readonly SeasonBackfillJob[]): Promise<void> {
    if (jobs.length === 0) {
      return
    }

    const requests = jobs.map(({ character, seasonId }) => ({
      ...syncRequest(character),
      kind: 'season-backfill' as const,
      seasonId
    }))

    await this.repository.request(requests)
  }

  // 옛 시즌 받기 요청 행이 남아 있는 시즌이 받는 중인 시즌이다.
  async readSeasonBackfillRunning(
    characters: readonly TimelineCharacter[]
  ): Promise<ReadonlySet<number>> {
    if (characters.length === 0) {
      return new Set()
    }

    return new Set(await this.repository.readSeasonBackfillSeasons(characters))
  }
}
