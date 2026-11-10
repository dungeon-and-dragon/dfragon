import {
  type DatabaseClient,
  readEnhancementBackfilledUntil,
  readSeasonBackfillStates,
  readTimelineSyncState,
  recordSeasonBackfillCompleted,
  recordTimelineSyncFailure,
  recordTimelineSyncSuccess,
  replaceEnhancementBackfillRange,
  replaceSeasonBackfillRange,
  replaceTimelineRange
} from '@dfragon/database'
import type { EnhancementBackfillStore } from '../../application/character-timeline/backfill.js'
import { ENHANCEMENT_CODES } from '../../domain/character-timeline/project.js'
import type { SeasonBackfillStore } from '../../application/character-timeline/season-backfill.js'
import type { TimelineStore } from '../../application/character-timeline/sync.js'

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

export function createDatabaseSeasonBackfillStore(client: DatabaseClient): SeasonBackfillStore {
  return {
    readState: async (character, seasonId) => {
      const [state] = await readSeasonBackfillStates(client, [character], seasonId)

      return state
    },
    replaceRange: (character, seasonId, range, { events, items }) =>
      replaceSeasonBackfillRange(client, character, seasonId, range, events, items),
    recordCompleted: (character, seasonId) =>
      recordSeasonBackfillCompleted(client, character, seasonId)
  }
}
