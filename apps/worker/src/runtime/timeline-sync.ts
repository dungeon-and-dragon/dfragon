import { setTimeout } from 'node:timers/promises'
import {
  type DatabaseClient,
  type DatabaseConfiguration,
  createDatabaseClient
} from '@dfragon/database'
import { ItemDictionaryService } from '@dfragon/server-core/application/item-dictionary/index.js'
import { ENHANCEMENT_BACKFILL_CODES } from '@dfragon/server-core/domain/character-timeline/index.js'
import {
  DatabaseEnhancementBackfillRepository,
  DatabaseItemDictionaryRepository,
  DatabaseSeasonBackfillRepository,
  DatabaseTimelineSyncRepository
} from '@dfragon/server-core/infrastructure/database/index.js'
import {
  createNeopleCharacterTimeline,
  createNeopleItemDetails
} from '@dfragon/server-core/infrastructure/neople/index.js'
import {
  TIMELINE_SYNC_LANES,
  TimelineSyncRequestService
} from '#application/timeline-sync/index.js'
import type { TimelineSyncRequestPorts } from '#application/timeline-sync/ports.js'
import { DatabaseTimelineSyncRequestRepository } from '#infrastructure/database/index.js'
import type { WorkerNeople } from '#infrastructure/neople/index.js'

// 일 하나가 연결을 한 번에 하나만 쓴다. 풀을 동시 처리 수의 합으로 두어 구간 교체 transaction이 연결을 기다리다
// Prisma의 시작 대기 2초를 넘겨 실패하지 않게 하고, worker의 다른 일과 연결을 다투지 않게 한다(ADR 0089).
const TIMELINE_CONCURRENCY = TIMELINE_SYNC_LANES.reduce(
  (sum, { concurrency }) => sum + concurrency,
  0
)
const TIMELINE_POOL = { maxConnections: TIMELINE_CONCURRENCY }

export function createTimelineSyncRequests(
  database: DatabaseConfiguration,
  client: DatabaseClient,
  neople: WorkerNeople,
  report: TimelineSyncRequestPorts['report']
): TimelineSyncRequestService {
  const timelineClient = createDatabaseClient(database, TIMELINE_POOL)
  const itemDictionary = new ItemDictionaryService(
    new DatabaseItemDictionaryRepository(timelineClient),
    createNeopleItemDetails(neople)
  )

  const requests = new DatabaseTimelineSyncRequestRepository(client)
  const sync = new DatabaseTimelineSyncRepository(timelineClient)
  const enhancementBackfill = new DatabaseEnhancementBackfillRepository(timelineClient)
  const seasonBackfill = new DatabaseSeasonBackfillRepository(timelineClient)
  const fetchTimeline = createNeopleCharacterTimeline(neople)
  const fetchEnhancementTimeline = createNeopleCharacterTimeline(neople, ENHANCEMENT_BACKFILL_CODES)

  return new TimelineSyncRequestService(
    { requests, sync, enhancementBackfill, seasonBackfill },
    { fetchTimeline, fetchEnhancementTimeline, itemDictionary, report, pause: setTimeout }
  )
}
