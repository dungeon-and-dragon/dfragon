import type { StoredSeason, TimelineSyncRequest, TimelineSyncRequestKind } from '@dfragon/database'

export interface TimelineSyncRequestRepository {
  releaseStarted(): Promise<void>
  claim(kind: TimelineSyncRequestKind, limit: number): Promise<TimelineSyncRequest[]>
  remove(request: TimelineSyncRequest): Promise<void>
  release(request: TimelineSyncRequest): Promise<void>
  readSeasons(): Promise<StoredSeason[]>
}
