import type {
  TimelineCharacter,
  TimelineSyncRequest,
  TimelineSyncStateRow
} from '@dfragon/database'

export interface TimelineSyncRequestRepository {
  readStates(characters: readonly TimelineCharacter[]): Promise<TimelineSyncStateRow[]>
  request(requests: readonly TimelineSyncRequest[]): Promise<void>
  readSeasonBackfillSeasons(characters: readonly TimelineCharacter[]): Promise<number[]>
}
