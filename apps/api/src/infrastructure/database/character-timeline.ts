import {
  type DatabaseClient,
  type SeasonBackfillState,
  type TimelineCharacter,
  type TimelineItemCursor,
  type TimelineItemInput,
  type TimelineQueueCount,
  type TimelineRange,
  type TimelineSyncState,
  readEnhancementBackfilledUntil,
  readSeasonBackfillStates,
  readTimelineSyncState,
  recordSeasonBackfillCompleted,
  recordTimelineSyncFailure,
  recordTimelineSyncSuccess,
  replaceEnhancementBackfillRange,
  replaceSeasonBackfillRange,
  replaceTimelineRange,
  writeTimelineQueueCounts
} from '@dfragon/database'
import type {
  CharacterTimelineRepository,
  EnhancementBackfillRepository,
  SeasonBackfillRepository,
  TimelineQueueCountRepository,
  TimelineSyncRepository
} from '../../application/character-timeline/repository.js'
import type { TimelineSyncFailure } from '../../application/character-timeline/sync.js'
import {
  type CharacterTimeline,
  ENHANCEMENT_CODES,
  type TimelineItemPage,
  type TimelinePageList
} from '../../domain/character-timeline/project.js'
import type { TimelineInputs } from '../../domain/character-timeline/rows.js'
import { readCharacterTimeline, readTimelinePage } from './character-timeline-read.js'

export class DatabaseCharacterTimelineRepository implements CharacterTimelineRepository {
  constructor(private readonly client: DatabaseClient) {}

  readTimeline(character: TimelineCharacter): Promise<CharacterTimeline> {
    return readCharacterTimeline(this.client, character, new Date())
  }

  readPage(
    character: TimelineCharacter,
    list: TimelinePageList,
    before: TimelineItemCursor
  ): Promise<TimelineItemPage> {
    return readTimelinePage(this.client, character, list, before)
  }
}

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
    items: readonly TimelineItemInput[]
  ): Promise<void> {
    return replaceEnhancementBackfillRange(this.client, character, range, ENHANCEMENT_CODES, items)
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

export class DatabaseTimelineQueueCountRepository implements TimelineQueueCountRepository {
  constructor(private readonly client: DatabaseClient) {}

  writeCounts(counts: readonly TimelineQueueCount[]): Promise<void> {
    return writeTimelineQueueCounts(this.client, counts)
  }
}
