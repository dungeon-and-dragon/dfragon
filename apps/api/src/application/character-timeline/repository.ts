import type {
  TimelineCharacter,
  TimelineItemCursor,
  TimelineSyncRequest,
  TimelineSyncStateRow
} from '@dfragon/database'
import type {
  CharacterTimeline,
  TimelineItemPage,
  TimelinePageList
} from '@dfragon/server-core/domain/character-timeline/index.js'

export interface CharacterTimelineRepository {
  readTimeline(character: TimelineCharacter): Promise<CharacterTimeline>
  readPage(
    character: TimelineCharacter,
    list: TimelinePageList,
    before: TimelineItemCursor
  ): Promise<TimelineItemPage>
}

export interface TimelineSyncRequestRepository {
  readStates(characters: readonly TimelineCharacter[]): Promise<TimelineSyncStateRow[]>
  request(requests: readonly TimelineSyncRequest[], options: { awaited: boolean }): Promise<void>
  has(request: TimelineSyncRequest): Promise<boolean>
  readSeasonBackfillSeasons(characters: readonly TimelineCharacter[]): Promise<number[]>
}
