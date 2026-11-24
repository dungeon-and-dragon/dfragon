import type { TimelineCharacter, TimelineItemCursor, TimelineQueueCount } from '@dfragon/database'
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

export interface TimelineQueueCountRepository {
  writeCounts(counts: readonly TimelineQueueCount[]): Promise<void>
}
