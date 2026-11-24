import {
  type DatabaseClient,
  type TimelineCharacter,
  type TimelineItemCursor,
  type TimelineSyncRequest,
  type TimelineSyncStateRow,
  hasTimelineSyncRequest,
  readSeasonBackfillRequestSeasons,
  readTimelineSyncStates,
  requestTimelineSync
} from '@dfragon/database'
import type {
  CharacterTimelineRepository,
  TimelineSyncRequestRepository
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

export class DatabaseTimelineSyncRequestRepository implements TimelineSyncRequestRepository {
  constructor(private readonly client: DatabaseClient) {}

  readStates(characters: readonly TimelineCharacter[]): Promise<TimelineSyncStateRow[]> {
    return readTimelineSyncStates(this.client, characters)
  }

  request(requests: readonly TimelineSyncRequest[], options: { awaited: boolean }): Promise<void> {
    return requestTimelineSync(this.client, requests, options)
  }

  has(request: TimelineSyncRequest): Promise<boolean> {
    return hasTimelineSyncRequest(this.client, request)
  }

  readSeasonBackfillSeasons(characters: readonly TimelineCharacter[]): Promise<number[]> {
    return readSeasonBackfillRequestSeasons(this.client, characters)
  }
}
