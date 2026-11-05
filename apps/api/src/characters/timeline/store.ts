import {
  type DatabaseClient,
  readEnhancementBackfilledUntil,
  readTimelineSyncState,
  recordTimelineSyncFailure,
  recordTimelineSyncSuccess,
  replaceEnhancementBackfillRange,
  replaceTimelineRange
} from '@dfragon/database'
import type { EnhancementBackfillStore } from './backfill.js'
import { ENHANCEMENT_CODES } from './read.js'
import type { TimelineStore } from './sync.js'

export function createDatabaseTimelineStore(client: DatabaseClient): TimelineStore {
  return {
    readSyncState: (character) => readTimelineSyncState(client, character),
    replaceRange: (character, range, { events, items }) =>
      replaceTimelineRange(client, character, range, events, items),
    recordSuccess: (character) => recordTimelineSyncSuccess(client, character),
    recordFailure: (character, failure) => recordTimelineSyncFailure(client, character, failure)
  }
}

export function createDatabaseEnhancementBackfillStore(
  client: DatabaseClient
): EnhancementBackfillStore {
  return {
    readBackfilledUntil: (character) => readEnhancementBackfilledUntil(client, character),
    replaceRange: (character, range, items) =>
      replaceEnhancementBackfillRange(client, character, range, ENHANCEMENT_CODES, items)
  }
}
