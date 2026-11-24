import type { TimelineCharacter, TimelineSyncRequest } from '@dfragon/database'
import {
  isEnhancementBackfilled,
  isSyncedRecently
} from '@dfragon/server-core/application/character-timeline/index.js'
import type { SeasonBackfillJob } from '@dfragon/server-core/domain/character-timeline/index.js'
import type { Pause } from './ports.js'
import type { TimelineSyncRequestRepository } from './repository.js'

// 이 시간을 넘기면 동기화가 끝나지 않았어도 그때 저장된 값으로 답한다(ADR 0091).
const SYNC_WAIT_MS = 10_000
// worker가 빈 테이블을 0.5초마다 보므로, 행이 없어진 뒤 그 절반 안에 알아챈다.
const SYNC_WAIT_POLL_MS = 250

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
  pause: Pause
}

export class TimelineSyncRequestService {
  private closed = false

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
      await this.repository.request(requests, { awaited: false })
    }
  }

  async syncAndWait(character: TimelineCharacter): Promise<void> {
    const [state] = await this.repository.readStates([character])

    if (isSyncedRecently(state, this.ports.now())) {
      return
    }

    const request = syncRequest(character)
    await this.repository.request([request], { awaited: true })

    const deadline = this.ports.now().getTime() + SYNC_WAIT_MS

    while (!this.closed && (await this.repository.has(request))) {
      const remaining = deadline - this.ports.now().getTime()

      if (remaining <= 0) {
        return
      }

      await this.ports.pause(Math.min(SYNC_WAIT_POLL_MS, remaining))
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

    await this.repository.request(requests, { awaited: false })
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

  close(): void {
    this.closed = true
  }
}
