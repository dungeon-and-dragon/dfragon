import type {
  SeasonBackfillState,
  TimelineCharacter,
  TimelineRange,
  TimelineSyncState
} from '@dfragon/database'
import type { TimelineInputs, TimelineSyncFailure } from '#domain/character-timeline/index.js'

export interface TimelineSyncRepository {
  readSyncState(character: TimelineCharacter): Promise<TimelineSyncState | undefined>
  replaceRange(
    character: TimelineCharacter,
    range: TimelineRange,
    inputs: TimelineInputs
  ): Promise<void>
  recordActive(character: TimelineCharacter, lastActiveAt: Date): Promise<void>
  recordSuccess(character: TimelineCharacter): Promise<void>
  recordFailure(character: TimelineCharacter, failure: TimelineSyncFailure): Promise<void>
}

export interface EnhancementBackfillRepository {
  readBackfilledUntil(character: TimelineCharacter): Promise<Date | null>
  replaceRange(
    character: TimelineCharacter,
    range: TimelineRange,
    inputs: TimelineInputs
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
