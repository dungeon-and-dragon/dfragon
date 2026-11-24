import type { TimelineCharacter, TimelineRange } from '@dfragon/database'

export type SeasonBackfillTarget = {
  character: TimelineCharacter
  seasonId: number
}

export type SeasonBackfillJob = SeasonBackfillTarget & { range: TimelineRange }
