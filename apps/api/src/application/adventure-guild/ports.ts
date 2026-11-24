import type { TimelineSyncRequestService } from '#application/character-timeline/index.js'

export type SeasonBackfillRequests = Pick<
  TimelineSyncRequestService,
  'requestSeasonBackfill' | 'readSeasonBackfillRunning'
>
