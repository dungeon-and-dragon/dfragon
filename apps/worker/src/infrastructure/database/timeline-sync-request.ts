import {
  type DatabaseClient,
  type StoredSeason,
  type TimelineSyncRequest,
  type TimelineSyncRequestKind,
  claimTimelineSyncRequests,
  deleteTimelineSyncRequest,
  readSeasons,
  releaseStartedTimelineSyncRequests,
  releaseTimelineSyncRequest
} from '@dfragon/database'
import type { TimelineSyncRequestRepository } from '#application/timeline-sync/repository.js'

export class DatabaseTimelineSyncRequestRepository implements TimelineSyncRequestRepository {
  constructor(private readonly client: DatabaseClient) {}

  releaseStarted(): Promise<void> {
    return releaseStartedTimelineSyncRequests(this.client)
  }

  claim(kind: TimelineSyncRequestKind, limit: number): Promise<TimelineSyncRequest[]> {
    return claimTimelineSyncRequests(this.client, kind, limit)
  }

  remove(request: TimelineSyncRequest): Promise<void> {
    return deleteTimelineSyncRequest(this.client, request)
  }

  release(request: TimelineSyncRequest): Promise<void> {
    return releaseTimelineSyncRequest(this.client, request)
  }

  readSeasons(): Promise<StoredSeason[]> {
    return readSeasons(this.client)
  }
}
