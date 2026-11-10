import { type DynamicModule, Module } from '@nestjs/common'
import {
  ADVENTURE_GUILD_SERVICE,
  AdventureGuildController
} from '../../presentation/http/adventure-guild/controller.js'
import { type AdventureGuildReader } from '../../application/adventure-guild/ports.js'
import {
  createAdventureGuildService,
  emptyAdventureGuildService,
  noSeasonBackfill
} from '../../application/adventure-guild/service.js'
import type { TimelineSyncQueue } from '../../application/character-timeline/queue.js'
import type { SeasonBackfillQueue } from '../../application/character-timeline/season-backfill.js'
import { SEASON_BACKFILL_QUEUE, TIMELINE_SYNC_QUEUE } from './character-timeline.js'

export interface AdventureGuildModuleOptions {
  readonly reader?: AdventureGuildReader
}

@Module({})
export class AdventureGuildModule {
  static register({ reader }: AdventureGuildModuleOptions): DynamicModule {
    return {
      module: AdventureGuildModule,
      controllers: [AdventureGuildController],
      providers: [
        {
          provide: ADVENTURE_GUILD_SERVICE,
          // 타임라인 queue는 DB 설정이 있을 때만 있어, 테스트처럼 모험단 읽기만 준 앱은 동기화를 요청하지 않는다.
          inject: [
            { token: TIMELINE_SYNC_QUEUE, optional: true },
            { token: SEASON_BACKFILL_QUEUE, optional: true }
          ],
          useFactory: (
            queue: TimelineSyncQueue | undefined,
            seasonBackfillQueue: SeasonBackfillQueue | undefined
          ) => {
            if (!reader) {
              return emptyAdventureGuildService
            }
            const requestTimelineSync = queue?.request ?? (() => undefined)
            const seasonBackfill = seasonBackfillQueue ?? noSeasonBackfill

            return createAdventureGuildService(reader, requestTimelineSync, seasonBackfill)
          }
        }
      ]
    }
  }
}
