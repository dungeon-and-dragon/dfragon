import {
  type DatabaseClient,
  type TimelineCharacter,
  type TimelineSyncRequest,
  type TimelineSyncStateRow,
  readSeasonBackfillRequestSeasons,
  readTimelineSyncStates,
  requestTimelineSync
} from '@dfragon/database'
import type { TimelineSyncRequestRepository } from '#application/character-timeline/repository.js'

export class DatabaseTimelineSyncRequestRepository implements TimelineSyncRequestRepository {
  constructor(private readonly client: DatabaseClient) {}

  readStates(characters: readonly TimelineCharacter[]): Promise<TimelineSyncStateRow[]> {
    return readTimelineSyncStates(this.client, characters)
  }

  request(requests: readonly TimelineSyncRequest[]): Promise<void> {
    return requestTimelineSync(this.client, requests, { awaited: false })
  }

  readSeasonBackfillSeasons(characters: readonly TimelineCharacter[]): Promise<number[]> {
    return readSeasonBackfillRequestSeasons(this.client, characters)
  }
}
