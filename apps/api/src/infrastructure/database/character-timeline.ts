import {
  type DatabaseClient,
  type TimelineCharacter,
  type TimelineItemCursor,
  type TimelineQueueCount,
  writeTimelineQueueCounts
} from '@dfragon/database'
import type {
  CharacterTimelineRepository,
  TimelineQueueCountRepository
} from '#application/character-timeline/repository.js'
import type {
  CharacterTimeline,
  TimelineItemPage,
  TimelinePageList
} from '@dfragon/server-core/domain/character-timeline/index.js'
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

export class DatabaseTimelineQueueCountRepository implements TimelineQueueCountRepository {
  constructor(private readonly client: DatabaseClient) {}

  writeCounts(counts: readonly TimelineQueueCount[]): Promise<void> {
    return writeTimelineQueueCounts(this.client, counts)
  }
}
