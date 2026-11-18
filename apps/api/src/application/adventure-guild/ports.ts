import type { SeasonBackfillQueue } from '../character-timeline/index.js'

export type SeasonBackfillRequests = Pick<SeasonBackfillQueue, 'request' | 'has'>
