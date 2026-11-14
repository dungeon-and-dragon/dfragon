import type { SeasonBackfillQueue } from '../character-timeline/season-backfill.js'

export type SeasonBackfillRequests = Pick<SeasonBackfillQueue, 'request' | 'has'>
