import type { SeasonBackfillQueue } from '#application/character-timeline/index.js'

export type SeasonBackfillRequests = Pick<SeasonBackfillQueue, 'request' | 'has'>
