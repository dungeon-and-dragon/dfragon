import {
  type DatabaseClient,
  readTimelineSyncState,
  recordTimelineSyncFailure,
  recordTimelineSyncSuccess,
  replaceTimelineRange
} from '@dfragon/database'
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
