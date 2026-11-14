import type {
  SeasonBackfillState,
  TimelineCharacter,
  TimelineItemCursor,
  TimelineItemInput,
  TimelineQueueCount,
  TimelineRange,
  TimelineSyncState
} from '@dfragon/database'
import type {
  CharacterTimeline,
  TimelineItemPage,
  TimelinePageList
} from '../../domain/character-timeline/project.js'
import type { TimelineInputs } from '../../domain/character-timeline/rows.js'
import type { TimelineSyncFailure } from './sync.js'

export interface CharacterTimelineRepository {
  readTimeline(character: TimelineCharacter): Promise<CharacterTimeline>
  readPage(
    character: TimelineCharacter,
    list: TimelinePageList,
    before: TimelineItemCursor
  ): Promise<TimelineItemPage>
}

export interface TimelineSyncRepository {
  readSyncState(character: TimelineCharacter): Promise<TimelineSyncState | undefined>
  replaceRange(
    character: TimelineCharacter,
    range: TimelineRange,
    inputs: TimelineInputs
  ): Promise<void>
  recordSuccess(character: TimelineCharacter): Promise<void>
  recordFailure(character: TimelineCharacter, failure: TimelineSyncFailure): Promise<void>
}

export interface EnhancementBackfillRepository {
  readBackfilledUntil(character: TimelineCharacter): Promise<Date | null>
  replaceRange(
    character: TimelineCharacter,
    range: TimelineRange,
    items: readonly TimelineItemInput[]
  ): Promise<void>
}

export interface SeasonBackfillRepository {
  readState(
    character: TimelineCharacter,
    seasonId: number
  ): Promise<SeasonBackfillState | undefined>
  replaceRange(
    character: TimelineCharacter,
    seasonId: number,
    range: TimelineRange,
    inputs: TimelineInputs
  ): Promise<void>
  recordCompleted(character: TimelineCharacter, seasonId: number): Promise<void>
}

export interface TimelineQueueCountRepository {
  writeCounts(counts: readonly TimelineQueueCount[]): Promise<void>
}
