import type { TimelineSyncRequest, TimelineSyncRequestKind } from '@dfragon/database'
import {
  EnhancementBackfillService,
  SeasonBackfillService,
  TimelineSyncService
} from '@dfragon/server-core/application/character-timeline/index.js'
import type { FetchCharacterTimeline } from '@dfragon/server-core/application/character-timeline/ports.js'
import type {
  EnhancementBackfillRepository,
  SeasonBackfillRepository,
  TimelineSyncRepository
} from '@dfragon/server-core/application/character-timeline/repository.js'
import {
  TimelineFailure,
  findSeasonBackfillRange
} from '@dfragon/server-core/domain/character-timeline/index.js'
import type { TimelineSyncRequestPorts } from './ports.js'
import type { TimelineSyncRequestRepository } from './repository.js'

export type TimelineSyncLane = {
  kind: TimelineSyncRequestKind
  concurrency: number
}

// 측정으로 정한 값이 아닌 시작값이다. API 안에서 4와 2로 돌 때 초당 2~6명을 처리했고, 수집은 key당 동시 32로 돈다(#1990).
export const TIMELINE_SYNC_LANES: readonly TimelineSyncLane[] = [
  { kind: 'sync', concurrency: 16 },
  { kind: 'enhancement-backfill', concurrency: 4 },
  { kind: 'season-backfill', concurrency: 2 }
]

// 타임라인 조회가 요청 행이 없어지기를 기다리므로, 빈 테이블을 다시 보는 주기만큼 조회가 더 늦어진다(#1990).
const EMPTY_POLL_MS = 500
const UNAVAILABLE_PAUSE_MS = 60_000

const FAILURE_CODES: Readonly<Record<TimelineSyncRequestKind, string>> = {
  sync: 'TIMELINE_SYNC_FAILED',
  'enhancement-backfill': 'TIMELINE_BACKFILL_FAILED',
  'season-backfill': 'TIMELINE_SEASON_BACKFILL_FAILED'
}

type RequestOutcome = 'done' | 'unavailable'

export type TimelineSyncRequestRepositories = {
  requests: TimelineSyncRequestRepository
  sync: TimelineSyncRepository
  enhancementBackfill: EnhancementBackfillRepository
  seasonBackfill: SeasonBackfillRepository
}

// 정기 동기화는 Neople 실패를 동기화 상태에 남기고 던지지 않아, 쓸 key가 없었는지는 요청마다 받은 실패에서 본다.
function watchKeyShortage(fetchTimeline: FetchCharacterTimeline) {
  let shortage = false
  const fetch: FetchCharacterTimeline = async (identity, range) => {
    try {
      return await fetchTimeline(identity, range)
    } catch (error) {
      if (error instanceof TimelineFailure && error.keyShortage !== undefined) {
        shortage = true
      }

      throw error
    }
  }

  return { fetch, hadShortage: () => shortage }
}

export class TimelineSyncRequestService {
  constructor(
    private readonly repositories: TimelineSyncRequestRepositories,
    private readonly ports: TimelineSyncRequestPorts
  ) {}

  // 끝난 worker가 집어 둔 요청을 다시 집을 수 있게 되돌린다. 다른 worker가 집은 요청도 되돌리므로 worker 한 대를 전제로 한다(ADR 0045).
  async run(): Promise<never> {
    await this.repositories.requests.releaseStarted()

    return Promise.race(TIMELINE_SYNC_LANES.map((lane) => this.runLane(lane)))
  }

  private async runLane({ kind, concurrency }: TimelineSyncLane): Promise<never> {
    const running = new Set<Promise<void>>()
    const state: { unavailable: boolean; failure?: { error: unknown } } = { unavailable: false }

    for (;;) {
      if (state.failure !== undefined) {
        throw state.failure.error
      }

      if (state.unavailable) {
        this.ports.report('TIMELINE_SYNC_NEOPLE_UNAVAILABLE', { kind })
        await this.ports.pause(UNAVAILABLE_PAUSE_MS)
        state.unavailable = false
        continue
      }

      const free = concurrency - running.size

      // 운영에서 처리 중인 요청이 상한을 넘어 음수 LIMIT으로 집다가 worker가 죽은 적이 있다. 넘은 까닭은 확인하지 못해, 넘으면 집지 않고 기다린다.
      if (free <= 0) {
        await Promise.race(running)
        continue
      }

      const claimed = await this.repositories.requests.claim(kind, free)

      for (const request of claimed) {
        const task: Promise<void> = this.handle(request)
          .then(
            (outcome) => {
              if (outcome === 'unavailable') {
                state.unavailable = true
              }
            },
            (error: unknown) => {
              state.failure ??= { error }
            }
          )
          .finally(() => {
            running.delete(task)
          })

        running.add(task)
      }

      if (claimed.length < free) {
        await this.ports.pause(EMPTY_POLL_MS)
      }
    }
  }

  private async handle(request: TimelineSyncRequest): Promise<RequestOutcome> {
    const outcome = await this.process(request)

    if (outcome === 'unavailable') {
      await this.repositories.requests.release(request)
    } else {
      await this.repositories.requests.remove(request)
    }

    return outcome
  }

  private async process(request: TimelineSyncRequest): Promise<RequestOutcome> {
    const { fetchTimeline, fetchEnhancementTimeline, report } = this.ports
    const fetchRequestTimeline =
      request.kind === 'enhancement-backfill' ? fetchEnhancementTimeline : fetchTimeline
    const watched = watchKeyShortage(fetchRequestTimeline)

    try {
      await this.runRequest(request, watched.fetch)
    } catch {
      if (!watched.hadShortage()) {
        report(FAILURE_CODES[request.kind])
      }
    }

    if (watched.hadShortage()) {
      return 'unavailable'
    }

    return 'done'
  }

  private async runRequest(
    { kind, serverId, characterId, seasonId }: TimelineSyncRequest,
    fetchTimeline: FetchCharacterTimeline
  ): Promise<void> {
    const character = { serverId, characterId }

    switch (kind) {
      case 'sync': {
        const sync = new TimelineSyncService(
          this.repositories.sync,
          fetchTimeline,
          this.ports.itemDictionary
        )

        return sync.sync(character, () => this.ports.report('TIMELINE_ITEM_DICTIONARY_FAILED'))
      }
      case 'enhancement-backfill': {
        const backfill = new EnhancementBackfillService(
          this.repositories.enhancementBackfill,
          fetchTimeline
        )

        return backfill.backfill(character)
      }
      case 'season-backfill': {
        const range = findSeasonBackfillRange(
          await this.repositories.requests.readSeasons(),
          seasonId
        )

        // 다음 시즌이 없어 받을 구간이 없는 시즌이면 받지 않고 요청만 지운다.
        if (range === undefined) {
          return
        }

        const backfill = new SeasonBackfillService(this.repositories.seasonBackfill, fetchTimeline)

        return backfill.backfill({ character, seasonId, range })
      }
    }
  }
}
