import {
  type DatabaseClient,
  type SeasonBackfillState,
  type TimelineCharacter,
  type TimelineRange,
  type TimelineSyncState,
  readEnhancementBackfilledUntil,
  readSeasonBackfillStates,
  readTimelineSyncState,
  recordCharacterActive,
  recordSeasonBackfillCompleted,
  recordTimelineSyncFailure,
  recordTimelineSyncSuccess,
  replaceEnhancementBackfillRange,
  replaceSeasonBackfillRange,
  replaceTimelineRange
} from '@dfragon/database'
import type {
  EnhancementBackfillRepository,
  SeasonBackfillRepository,
  TimelineSyncRepository
} from '#application/character-timeline/repository.js'
import {
  ENHANCEMENT_BACKFILL_CODES,
  type TimelineInputs,
  type TimelineSyncFailure
} from '#domain/character-timeline/index.js'

export class DatabaseTimelineSyncRepository implements TimelineSyncRepository {
  constructor(private readonly client: DatabaseClient) {}

  readSyncState(character: TimelineCharacter): Promise<TimelineSyncState | undefined> {
    return readTimelineSyncState(this.client, character)
  }

  replaceRange(
    character: TimelineCharacter,
    range: TimelineRange,
    { events, items }: TimelineInputs
  ): Promise<void> {
    return replaceTimelineRange(this.client, character, range, events, items)
  }

  recordActive(character: TimelineCharacter, lastActiveAt: Date): Promise<void> {
    return recordCharacterActive(this.client, character, lastActiveAt)
  }

  recordSuccess(character: TimelineCharacter): Promise<void> {
    return recordTimelineSyncSuccess(this.client, character)
  }

  recordFailure(character: TimelineCharacter, failure: TimelineSyncFailure): Promise<void> {
    return recordTimelineSyncFailure(this.client, character, failure)
  }
}

export class DatabaseEnhancementBackfillRepository implements EnhancementBackfillRepository {
  constructor(private readonly client: DatabaseClient) {}

  readBackfilledUntil(character: TimelineCharacter): Promise<Date | null> {
    return readEnhancementBackfilledUntil(this.client, character)
  }

  replaceRange(
    character: TimelineCharacter,
    range: TimelineRange,
    { events, items }: TimelineInputs
  ): Promise<void> {
    return replaceEnhancementBackfillRange(
      this.client,
      character,
      range,
      ENHANCEMENT_BACKFILL_CODES,
      events,
      items
    )
  }
}

export class DatabaseSeasonBackfillRepository implements SeasonBackfillRepository {
  constructor(private readonly client: DatabaseClient) {}

  async readState(
    character: TimelineCharacter,
    seasonId: number
  ): Promise<SeasonBackfillState | undefined> {
    const [state] = await readSeasonBackfillStates(this.client, [character], seasonId)

    return state
  }

  replaceRange(
    character: TimelineCharacter,
    seasonId: number,
    range: TimelineRange,
    { events, items }: TimelineInputs
  ): Promise<void> {
    return replaceSeasonBackfillRange(this.client, character, seasonId, range, events, items)
  }

  recordCompleted(character: TimelineCharacter, seasonId: number): Promise<void> {
    return recordSeasonBackfillCompleted(this.client, character, seasonId)
  }
}
