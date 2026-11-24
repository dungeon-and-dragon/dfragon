import { setTimeout } from 'node:timers/promises'
import type { TimelineCharacter } from '@dfragon/database'
import type { NeopleStageTimings } from '@dfragon/server-core/application/character-detail/index.js'
import type { ReportCode } from '@dfragon/http-server'
import { neopleCharacterImageUrl } from '@dfragon/neople'
import type { AdventureGuildRepository } from '#application/adventure-guild/repository.js'
import {
  AdventureGuildService,
  emptyAdventureGuildRepository,
  noSeasonBackfill
} from '#application/adventure-guild/index.js'
import type { CharacterBasicRepository } from '#application/character-basic/repository.js'
import {
  type CharacterHistoryRepository,
  emptyCharacterHistoryRepository
} from '#application/character-history/repository.js'
import { CharacterHistoryService } from '#application/character-history/index.js'
import { CharacterBasicService } from '#application/character-basic/index.js'
import {
  type CharacterDetailDependencies,
  CharacterDetailService
} from '#application/character-detail/index.js'
import { EquipmentSimulationService } from '#application/equipment-simulation/index.js'
import type { FetchCharacterImage } from '#application/character-image/ports.js'
import { CharacterImageService } from '#application/character-image/index.js'
import { ItemDetailService } from '#application/item-detail/index.js'
import type { SearchCharacters } from '#application/character-search/ports.js'
import type { CharacterSearchRepository } from '#application/character-search/repository.js'
import {
  CharacterSearchService,
  emptyCharacterSearchRepository
} from '#application/character-search/index.js'
import {
  CharacterTimelineService,
  type RequestTimelineSync,
  TimelineSyncRequestService,
  emptyCharacterTimelineRepository,
  noTimelineSync
} from '#application/character-timeline/index.js'
import type {
  CharacterTimelineRepository,
  TimelineSyncRequestRepository
} from '#application/character-timeline/repository.js'
import type { ClearStatsRepository } from '@dfragon/server-core/application/content-clears/repository.js'
import { ClearStatsService, emptyClearStatsRepository } from '#application/content-clears/index.js'
import type { RankingStatsRepository } from '#application/ranking-stats/repository.js'
import {
  RankingStatsService,
  emptyRankingStatsRepository
} from '#application/ranking-stats/index.js'
import type { FetchLowestListing } from '#application/soul-prices/ports.js'
import { SoulPriceService } from '#application/soul-prices/index.js'
import type { FetchShopGrade } from '#application/today-grade/ports.js'
import { TodayGradeService } from '#application/today-grade/index.js'
import { CharacterFetched } from '#domain/character-events.js'
import { SoulPriceFailure } from '#domain/soul-prices/index.js'
import { readApiBuildInfo } from '#infrastructure/build-info.js'
import {
  parseCharacterBasic,
  parseCharacterSets,
  parseCharacterSkillStyle
} from '@dfragon/server-core/infrastructure/neople/index.js'
import { createNeopleCharacterImage } from '#infrastructure/neople/index.js'
import {
  type ScoreEngineOptions,
  createScoreEngine
} from '@dfragon/server-core/infrastructure/score/index.js'

export interface TimelineSyncOptions {
  readonly read: CharacterTimelineRepository['readTimeline']
  readonly readPage: CharacterTimelineRepository['readPage']
  // 동기화는 캐릭터 목록 worker가 하고, API는 요청 테이블에 넣고 행이 없어지기를 기다린다(ADR 0091).
  readonly requests: TimelineSyncRequestRepository
  readonly close: () => Promise<void>
}

export interface ApiServicesOptions {
  readonly search: {
    readonly searchCharacters: SearchCharacters
    readonly readAdventureNames?: CharacterSearchRepository['readAdventureNames']
    readonly readCharacterScores?: CharacterSearchRepository['readCharacterScores']
  }
  readonly details: Omit<CharacterDetailDependencies, 'calculateScore' | 'publishCharacterFetched'>
  readonly timeline?: TimelineSyncOptions
  readonly recordCharacterBasic?: CharacterBasicRepository['recordBasic']
  readonly recordCharacterSkillStyle?: CharacterBasicRepository['recordSkillStyle']
  readonly recordCharacterScore?: CharacterBasicRepository['recordScore']
  readonly recordCharacterHistory?: CharacterBasicRepository['recordHistory']
  readonly recordCharacterSets?: CharacterBasicRepository['recordSets']
  readonly characterHistory?: CharacterHistoryRepository
  readonly adventureGuild?: AdventureGuildRepository
  readonly rankingStats?: RankingStatsRepository
  readonly clearStats?: ClearStatsRepository
  readonly todayGrade: { readonly fetchShopGrade: FetchShopGrade }
  readonly soulPrices?: { readonly fetchLowestListing: FetchLowestListing }
  readonly fetchCharacterImage?: FetchCharacterImage
  readonly buildInfoPath?: string
  readonly scoreLibraryPath?: string | null
  readonly spawnScoreWorker?: ScoreEngineOptions['spawn']
}

type CharacterFetchedSubscriber = (event: CharacterFetched) => void

// 시뮬레이션은 상세 조회의 Neople 단계 시간을 접근 로그에 남기지 않는다.
const unrecordedTimings: NeopleStageTimings = {
  record: () => undefined,
  markShared: () => undefined
}

// 경매장 조회를 넘기지 않은 실행에서는 Neople을 부를 수 없으므로 조회할 수 없음으로 답한다.
const noLowestListing: FetchLowestListing = async () => {
  throw new SoulPriceFailure('unavailable')
}

function createTimelineSync(timeline: TimelineSyncOptions, reportCode: ReportCode) {
  const requests = new TimelineSyncRequestService(timeline.requests, {
    now: () => new Date(),
    pause: setTimeout
  })

  const requestInBackground = (
    characters: readonly TimelineCharacter[],
    enhancementBackfill: boolean
  ) => {
    requests.request(characters, { enhancementBackfill }).catch(() => {
      reportCode('TIMELINE_SYNC_REQUEST_FAILED')
    })
  }

  const repository: CharacterTimelineRepository = {
    readTimeline: timeline.read,
    readPage: timeline.readPage
  }
  const service = new CharacterTimelineService(repository, requests)

  return { requests, requestInBackground, service }
}

type TimelineSync = ReturnType<typeof createTimelineSync>

export type ApiServices = Awaited<ReturnType<typeof createApiServices>>['services']

function createAdventureGuild(
  repository: AdventureGuildRepository | undefined,
  timelineSync: TimelineSync | undefined
): AdventureGuildService {
  if (repository === undefined) {
    return new AdventureGuildService(
      emptyAdventureGuildRepository,
      () => undefined,
      noSeasonBackfill
    )
  }

  // 요청 테이블은 DB 설정이 있을 때만 있어, 테스트처럼 모험단 읽기만 준 앱은 동기화를 요청하지 않는다.
  const requestTimelineSync: RequestTimelineSync =
    timelineSync !== undefined
      ? (characters) => timelineSync.requestInBackground(characters, false)
      : () => undefined
  const seasonBackfill = timelineSync?.requests ?? noSeasonBackfill

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

  // DB 설정이 없으면 구독 함수가 없어, 상세 조회가 캐릭터를 받아도 동기화와 기록을 하지 않는다.
  const subscribers: CharacterFetchedSubscriber[] = []
  if (timelineSync !== undefined) {
    subscribers.push(({ serverId, characterId }) => {
      timelineSync.requestInBackground([{ serverId, characterId }], true)
    })
  }

  if (recordCharacterBasic !== undefined) {
    // 스킬 스타일, 점수, 이력, 세트 기록 함수를 주지 않은 app은 그 기록을 하지 않는다.
    const repository: CharacterBasicRepository = {
      recordBasic: recordCharacterBasic,
      recordSkillStyle: options.recordCharacterSkillStyle ?? (async () => undefined),
      recordScore: options.recordCharacterScore ?? (async () => undefined),
      recordHistory: options.recordCharacterHistory ?? (async () => undefined),
      recordSets: options.recordCharacterSets ?? (async () => undefined)
    }
    const characterBasic = new CharacterBasicService(repository, {
      parseBasic: parseCharacterBasic,
      parseSkillStyle: parseCharacterSkillStyle,
      parseSets: parseCharacterSets,
      reportFailure: reportCode
    })
    subscribers.push((event) => characterBasic.record(event))
  }

  const { searchCharacters, readAdventureNames, readCharacterScores } = options.search
  const searchRepository: CharacterSearchRepository = {
    readAdventureNames: readAdventureNames ?? emptyCharacterSearchRepository.readAdventureNames,
    readCharacterScores: readCharacterScores ?? emptyCharacterSearchRepository.readCharacterScores
  }
  const search = new CharacterSearchService(
    searchRepository,
    searchCharacters,
    neopleCharacterImageUrl
  )
  const details = new CharacterDetailService({
    ...options.details,
    calculateScore: engine.calculate,
    publishCharacterFetched: ({ serverId, characterId }, payloads, fetchedAt, score) => {
      const event = new CharacterFetched(serverId, characterId, payloads, fetchedAt, score)
      for (const notify of subscribers) {
        try {
          notify(event)
        } catch {
          // 구독 함수의 실패가 상세 조회 응답을 바꾸지 않게 버린다.
        }
      }
    }
  })
  const equipmentSimulation = new EquipmentSimulationService(
    (identity, signal) => details.scoreSource(identity, signal, unrecordedTimings),
    (itemIds, signal) => options.details.catalog.load(itemIds, signal),
    engine.calculate
  )
  const characterHistory = new CharacterHistoryService(
    options.characterHistory ?? emptyCharacterHistoryRepository,
    options.details.catalog
  )
  const itemDetail = new ItemDetailService(options.details.catalog)
  const todayGrade = new TodayGradeService(options.todayGrade.fetchShopGrade)
  const soulPrices = new SoulPriceService(options.soulPrices?.fetchLowestListing ?? noLowestListing)
  const characterImage = new CharacterImageService(
    options.fetchCharacterImage ?? createNeopleCharacterImage()
  )
  const timelineService =
    timelineSync?.service ??
    new CharacterTimelineService(emptyCharacterTimelineRepository, noTimelineSync)
  const adventureGuild = createAdventureGuild(options.adventureGuild, timelineSync)
  const rankingStats = new RankingStatsService(options.rankingStats ?? emptyRankingStatsRepository)
  const clearStats = new ClearStatsService(options.clearStats ?? emptyClearStatsRepository, () =>
    reportCode('CLEAR_STATS_REFRESH_FAILED')
  )

  return {
    services: {
      buildInfo,
      search,
      details,
      equipmentSimulation,
      characterHistory,
      characterImage,
      timeline: timelineService,
      adventureGuild,
      rankingStats,
      clearStats,
      itemDetail,
      todayGrade,
      soulPrices
    },
    refreshClearStats: () => clearStats.refresh(),
    /** 한 단계가 실패해도 나머지 단계를 실행하고, 실패를 모아 던진다. */
    close(closeServer: () => Promise<void>): Promise<void> {
      return runCloseSteps([
        // server는 열린 요청이 끝나야 닫히므로, 진행 중인 요청을 먼저 취소한다.
        () => search.close(),
        // 시뮬레이션은 진행 중인 계산을 끊지 않고 기다리므로, 그 계산이 쓰는 점수 worker보다 먼저 닫는다.
        () => equipmentSimulation.close(),
        () => details.close(),
        () => todayGrade.close(),
        () => clearStats.close(),
        // server는 열린 요청이 끝나야 닫히므로, 동기화를 기다리던 타임라인 조회가 저장된 값으로 바로 답하게 한다.
        () => timelineSync?.requests.close(),
        closeServer,
        // worker를 멈추면 기다리던 계산이 점수 없이 끝나므로, 상세 조회가 진행 중인 요청을 취소한 뒤에 멈춘다.
        () => engine.close(),
        () => timeline?.close()
      ])
    }
  }
}
