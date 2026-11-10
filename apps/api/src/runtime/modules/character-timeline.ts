import type { ReadTimelinePage } from '../../application/character-timeline/ports.js'
import { type DynamicModule, type INestApplication, Module } from '@nestjs/common'
import type { TimelineCharacter } from '@dfragon/database'
import type { ReportCode } from '../../access-log.js'
import {
  CHARACTER_TIMELINE_SERVICE,
  CharacterTimelineController
} from '../../presentation/http/character-timeline/controller.js'
import {
  type JobQueueCounts,
  type TimelineSyncQueue,
  createTimelineSyncQueue
} from '../../application/character-timeline/queue.js'
import type { CharacterTimeline } from '../../domain/character-timeline/project.js'
import {
  type SeasonBackfillJob,
  type SeasonBackfillQueue,
  createSeasonBackfillQueue
} from '../../application/character-timeline/season-backfill.js'
import {
  createCharacterTimelineService,
  emptyCharacterTimelineService
} from '../../application/character-timeline/service.js'
import { TimelineSyncSubscriber } from '../../presentation/events/character-timeline.js'

export const TIMELINE_SYNC_QUEUE = Symbol('TIMELINE_SYNC_QUEUE')
const ENHANCEMENT_BACKFILL_QUEUE = Symbol('ENHANCEMENT_BACKFILL_QUEUE')
export const SEASON_BACKFILL_QUEUE = Symbol('SEASON_BACKFILL_QUEUE')

export interface TimelineSyncOptions {
  readonly sync: (character: TimelineCharacter) => Promise<void>
  readonly backfillEnhancements: (character: TimelineCharacter) => Promise<void>
  readonly backfillSeason: (job: SeasonBackfillJob) => Promise<void>
  readonly read: (character: TimelineCharacter) => Promise<CharacterTimeline>
  readonly readPage: ReadTimelinePage
  // 진행 중인 동기화를 기다리지 않고 닫는다.
  readonly close: () => Promise<void>
}

export interface CharacterTimelineModuleOptions {
  readonly timeline?: TimelineSyncOptions
  readonly reportCode: ReportCode
}

const TIMELINE_QUEUES = [
  { name: 'timeline-sync', token: TIMELINE_SYNC_QUEUE },
  { name: 'enhancement-backfill', token: ENHANCEMENT_BACKFILL_QUEUE },
  { name: 'season-backfill', token: SEASON_BACKFILL_QUEUE }
] as const

type TimelineQueueCount = JobQueueCounts & {
  readonly name: (typeof TIMELINE_QUEUES)[number]['name']
}

// queue는 DB 설정(`timeline`)을 준 app에만 있어, 그 밖의 app에서 부르면 provider를 찾지 못해 던진다.
export function readTimelineQueueCounts(app: INestApplication): TimelineQueueCount[] {
  return TIMELINE_QUEUES.map(({ name, token }) => ({
    name,
    ...app.get<Pick<TimelineSyncQueue, 'counts'>>(token).counts()
  }))
}

function timelineSyncProviders(timeline: TimelineSyncOptions, reportCode: ReportCode) {
  return [
    {
      provide: TIMELINE_SYNC_QUEUE,
      useFactory: () =>
        createTimelineSyncQueue(timeline.sync, () => reportCode('TIMELINE_SYNC_FAILED'))
    },
    {
      provide: ENHANCEMENT_BACKFILL_QUEUE,
      useFactory: () =>
        createTimelineSyncQueue(timeline.backfillEnhancements, () =>
          reportCode('TIMELINE_BACKFILL_FAILED')
        )
    },
    {
      provide: SEASON_BACKFILL_QUEUE,
      useFactory: () =>
        createSeasonBackfillQueue(timeline.backfillSeason, () =>
          reportCode('TIMELINE_SEASON_BACKFILL_FAILED')
        )
    },
    {
      provide: TimelineSyncSubscriber,
      inject: [TIMELINE_SYNC_QUEUE, ENHANCEMENT_BACKFILL_QUEUE, SEASON_BACKFILL_QUEUE],
      // 타임라인 조회가 백필을 기다리지 않도록 백필은 따로 queue를 둔다.
      useFactory: (
        queue: TimelineSyncQueue,
        enhancementBackfillQueue: TimelineSyncQueue,
        seasonBackfillQueue: SeasonBackfillQueue
      ) =>
        new TimelineSyncSubscriber(
          queue,
          enhancementBackfillQueue,
          seasonBackfillQueue,
          timeline.close
        )
    },
    {
      provide: CHARACTER_TIMELINE_SERVICE,
      inject: [TIMELINE_SYNC_QUEUE],
      useFactory: (queue: TimelineSyncQueue) =>
        createCharacterTimelineService(queue, timeline.read, timeline.readPage)
    }
  ]
}

// 모험단 module이 queue를 선택 주입으로 받도록 전역으로 둔다.
@Module({})
export class CharacterTimelineModule {
  static register({ timeline, reportCode }: CharacterTimelineModuleOptions): DynamicModule {
    // DB 설정이 없으면 구독자를 등록하지 않아, 상세 조회가 낸 이벤트를 받는 곳이 없다.
    if (timeline === undefined) {
      return {
        module: CharacterTimelineModule,
        controllers: [CharacterTimelineController],
        providers: [
          { provide: CHARACTER_TIMELINE_SERVICE, useValue: emptyCharacterTimelineService }
        ]
      }
    }

    return {
      module: CharacterTimelineModule,
      global: true,
      controllers: [CharacterTimelineController],
      providers: timelineSyncProviders(timeline, reportCode),
      exports: [TIMELINE_SYNC_QUEUE, SEASON_BACKFILL_QUEUE]
    }
  }
}
