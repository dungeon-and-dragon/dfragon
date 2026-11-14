import type { TimelineCharacter } from '@dfragon/database'
import type { ReportCode } from '@dfragon/http-server'
import { neopleCharacterImageUrl } from '@dfragon/neople'
import type { AdventureGuildRepository } from '../application/adventure-guild/repository.js'
import {
  AdventureGuildService,
  emptyAdventureGuildRepository,
  noSeasonBackfill
} from '../application/adventure-guild/service.js'
import type { CharacterBasicRepository } from '../application/character-basic/repository.js'
import { CharacterBasicService } from '../application/character-basic/service.js'
import {
  type CharacterDetailDependencies,
  CharacterDetailService
} from '../application/character-detail/service.js'
import type { FetchCharacterImage } from '../application/character-image/ports.js'
import { CharacterImageService } from '../application/character-image/service.js'
import type { SearchCharacters } from '../application/character-search/ports.js'
import type { CharacterSearchRepository } from '../application/character-search/repository.js'
import {
  CharacterSearchService,
  emptyCharacterSearchRepository
} from '../application/character-search/service.js'
import { createTimelineSyncQueue } from '../application/character-timeline/queue.js'
import { startQueueCountsWriter } from '../application/character-timeline/queue-counts.js'
import type {
  CharacterTimelineRepository,
  TimelineQueueCountRepository
} from '../application/character-timeline/repository.js'
import { createSeasonBackfillQueue } from '../application/character-timeline/season-backfill.js'
import {
  CharacterTimelineService,
  emptyCharacterTimelineRepository,
  noTimelineSync
} from '../application/character-timeline/service.js'
import type { ClearStatsReader } from '../application/content-clears/ports.js'
import {
  createClearStatsService,
  emptyClearStatsReader
} from '../application/content-clears/service.js'
import type { RankingStatsReader } from '../application/ranking-stats/ports.js'
import {
  createRankingStatsService,
  emptyRankingStatsReader
} from '../application/ranking-stats/service.js'
import type { FetchShopGrade } from '../application/today-grade/ports.js'
import { TodayGradeService } from '../application/today-grade/service.js'
import { CharacterFetched } from '../domain/character-events.js'
import type { SeasonBackfillJob } from '../domain/character-timeline/season-backfill.js'
import { readApiBuildInfo } from '../infrastructure/build-info.js'
import {
  parseCharacterBasic,
  parseCharacterSkillStyle
} from '../infrastructure/neople/character-basic.js'
import { createNeopleCharacterImage } from '../infrastructure/neople/character-image.js'
import { type ScoreEngineOptions, createScoreEngine } from '../infrastructure/score/engine.js'

export interface TimelineSyncOptions {
  readonly sync: (character: TimelineCharacter) => Promise<void>
  readonly backfillEnhancements: (character: TimelineCharacter) => Promise<void>
  readonly backfillSeason: (job: SeasonBackfillJob) => Promise<void>
  readonly read: CharacterTimelineRepository['readTimeline']
  readonly readPage: CharacterTimelineRepository['readPage']
  // 있으면 queue의 대기, 처리 중 수를 주기마다 쓴다. 운영 경로가 이 값을 읽는다.
  readonly writeQueueCounts?: TimelineQueueCountRepository['writeCounts']
  // 진행 중인 동기화를 기다리지 않고 닫는다.
  readonly close: () => Promise<void>
}

export interface ApiServicesOptions {
  readonly search: {
    readonly searchCharacters: SearchCharacters
    readonly readAdventureNames?: CharacterSearchRepository['readAdventureNames']
  }
  readonly details: Omit<CharacterDetailDependencies, 'calculateScore' | 'publishCharacterFetched'>
  readonly timeline?: TimelineSyncOptions
  readonly recordCharacterBasic?: CharacterBasicRepository['recordBasic']
  readonly recordCharacterSkillStyle?: CharacterBasicRepository['recordSkillStyle']
  readonly recordCharacterScore?: CharacterBasicRepository['recordScore']
  readonly adventureGuild?: AdventureGuildRepository
  readonly rankingStats?: RankingStatsReader
  readonly clearStats?: ClearStatsReader
  readonly todayGrade: { readonly fetchShopGrade: FetchShopGrade }
  readonly fetchCharacterImage?: FetchCharacterImage
  readonly buildInfoPath?: string
  readonly scoreLibraryPath?: string | null
  readonly spawnScoreWorker?: ScoreEngineOptions['spawn']
  readonly queueCountsIntervalMs?: number
}

type CharacterFetchedSubscriber = (event: CharacterFetched) => void

function createTimelineSync(timeline: TimelineSyncOptions, reportCode: ReportCode) {
  // 타임라인 조회가 백필을 기다리지 않도록 백필은 따로 queue를 둔다.
  const queues = {
    sync: createTimelineSyncQueue(timeline.sync, () => reportCode('TIMELINE_SYNC_FAILED')),
    enhancementBackfill: createTimelineSyncQueue(timeline.backfillEnhancements, () =>
      reportCode('TIMELINE_BACKFILL_FAILED')
    ),
    seasonBackfill: createSeasonBackfillQueue(timeline.backfillSeason, () =>
      reportCode('TIMELINE_SEASON_BACKFILL_FAILED')
    )
  }

  const repository: CharacterTimelineRepository = {
    readTimeline: timeline.read,
    readPage: timeline.readPage
  }
  const service = new CharacterTimelineService(repository, queues.sync)

  return { queues, service }
}

type TimelineQueues = ReturnType<typeof createTimelineSync>['queues']

export type ApiServices = Awaited<ReturnType<typeof createApiServices>>['services']

function createAdventureGuild(
  repository: AdventureGuildRepository | undefined,
  queues: TimelineQueues | undefined
): AdventureGuildService {
  if (repository === undefined) {
    return new AdventureGuildService(
      emptyAdventureGuildRepository,
      () => undefined,
      noSeasonBackfill
    )
  }

  // 타임라인 queue는 DB 설정이 있을 때만 있어, 테스트처럼 모험단 읽기만 준 앱은 동기화를 요청하지 않는다.
  const requestTimelineSync = queues?.sync.request ?? (() => undefined)
  const seasonBackfill = queues?.seasonBackfill ?? noSeasonBackfill

  return new AdventureGuildService(repository, requestTimelineSync, seasonBackfill)
}

async function runCloseSteps(steps: readonly (() => unknown)[]): Promise<void> {
  const failures: unknown[] = []
  for (const step of steps) {
    try {
      await step()
    } catch (error) {
      failures.push(error)
    }
  }
  if (failures.length > 0) {
    throw new AggregateError(failures, 'API services failed to close')
  }
}

export async function createApiServices(options: ApiServicesOptions, reportCode: ReportCode) {
  const { timeline, recordCharacterBasic } = options
  const buildInfo = await readApiBuildInfo(options.buildInfoPath)
  // worker는 listen을 기다리지 않고 시작해 준비 계산을 하며, 그동안 온 계산은 worker에 쌓였다가 차례로 계산된다.
  const engine = createScoreEngine({
    path: options.scoreLibraryPath ?? null,
    report: reportCode,
    spawn: options.spawnScoreWorker
  })
  const timelineSync = timeline && createTimelineSync(timeline, reportCode)
  const queues = timelineSync?.queues
  // queue는 DB 설정(`timeline`)을 준 app에만 있어, 그 밖의 app에서 부르면 던진다.
  const readQueueCounts = () => {
    if (queues === undefined) {
      throw new Error('Timeline queues need the timeline option')
    }

    return [
      { name: 'timeline-sync', ...queues.sync.counts() },
      { name: 'enhancement-backfill', ...queues.enhancementBackfill.counts() },
      { name: 'season-backfill', ...queues.seasonBackfill.counts() }
    ]
  }

  const queueCountsWriter =
    timeline?.writeQueueCounts &&
    startQueueCountsWriter(
      readQueueCounts,
      timeline.writeQueueCounts,
      () => reportCode('TIMELINE_QUEUE_COUNTS_WRITE_FAILED'),
      options.queueCountsIntervalMs
    )

  // DB 설정이 없으면 구독 함수가 없어, 상세 조회가 캐릭터를 받아도 동기화와 기록을 하지 않는다.
  const subscribers: CharacterFetchedSubscriber[] = []
  if (queues !== undefined) {
    subscribers.push(({ serverId, characterId }) => {
      queues.sync.request({ serverId, characterId })
      queues.enhancementBackfill.request({ serverId, characterId })
    })
  }

  if (recordCharacterBasic !== undefined) {
    // 스킬 스타일이나 점수 기록 함수를 주지 않은 app은 그 기록을 하지 않는다.
    const repository: CharacterBasicRepository = {
      recordBasic: recordCharacterBasic,
      recordSkillStyle: options.recordCharacterSkillStyle ?? (async () => undefined),
      recordScore: options.recordCharacterScore ?? (async () => undefined)
    }
    const characterBasic = new CharacterBasicService(repository, {
      parseBasic: parseCharacterBasic,
      parseSkillStyle: parseCharacterSkillStyle,
      reportFailure: reportCode
    })
    subscribers.push((event) => characterBasic.record(event))
  }

  const { searchCharacters, readAdventureNames } = options.search
  const searchRepository: CharacterSearchRepository =
    readAdventureNames !== undefined ? { readAdventureNames } : emptyCharacterSearchRepository
  const search = new CharacterSearchService(
    searchRepository,
    searchCharacters,
    neopleCharacterImageUrl
  )
  const details = new CharacterDetailService({
    ...options.details,
    calculateScore: engine.calculate,
    publishCharacterFetched: (
      { serverId, characterId },
      { basic, skill_style },
      fetchedAt,
      score
    ) => {
      const event = new CharacterFetched(
        serverId,
        characterId,
        basic,
        skill_style,
        fetchedAt,
        score
      )
      for (const notify of subscribers) {
        try {
          notify(event)
        } catch {
          // 구독 함수의 실패가 상세 조회 응답을 바꾸지 않게 버린다.
        }
      }
    }
  })
  const todayGrade = new TodayGradeService(options.todayGrade.fetchShopGrade)
  const characterImage = new CharacterImageService(
    options.fetchCharacterImage ?? createNeopleCharacterImage()
  )
  const timelineService =
    timelineSync?.service ??
    new CharacterTimelineService(emptyCharacterTimelineRepository, noTimelineSync)
  const adventureGuild = createAdventureGuild(options.adventureGuild, queues)
  const rankingStats = createRankingStatsService(options.rankingStats ?? emptyRankingStatsReader)
  const clearStats = createClearStatsService(options.clearStats ?? emptyClearStatsReader, () =>
    reportCode('CLEAR_STATS_REFRESH_FAILED')
  )

  return {
    services: {
      buildInfo,
      search,
      details,
      characterImage,
      timeline: timelineService,
      adventureGuild,
      rankingStats,
      clearStats,
      todayGrade
    },
    refreshClearStats: () => clearStats.refresh(),
    readQueueCounts,
    /** 한 단계가 실패해도 나머지 단계를 실행하고, 실패를 모아 던진다. */
    close(closeServer: () => Promise<void>): Promise<void> {
      return runCloseSteps([
        // server는 열린 요청이 끝나야 닫히므로, 진행 중인 요청을 먼저 취소한다.
        () => search.close(),
        () => details.close(),
        () => todayGrade.close(),
        () => clearStats.close(),
        closeServer,
        () => queueCountsWriter?.stop(),
        // Prisma는 닫은 뒤에도 다음 query에서 다시 연결하므로, queue를 닫지 않으면 대기열에 남은 일과 종료 뒤에 온 요청도 시작한다.
        () => queues?.sync.close(),
        () => queues?.enhancementBackfill.close(),
        () => queues?.seasonBackfill.close(),
        // worker를 멈추면 기다리던 계산이 점수 없이 끝나므로, 상세 조회가 진행 중인 요청을 취소한 뒤에 멈춘다.
        () => engine.close(),
        () => timeline?.close()
      ])
    }
  }
}
