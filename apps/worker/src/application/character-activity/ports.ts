import type { CollectedCharacter } from '@dfragon/database'
import type { FetchCharacterBasic, Pause } from '#application/character-collection/ports.js'
import type { ActivityRange } from '#domain/character-activity/index.js'

export type LatestActivity =
  | { status: 'active'; lastActiveAt: Date }
  | { status: 'idle' }
  | { status: 'unavailable' }
  | { status: 'failed' }

export type FetchLatestActivity = (
  character: CollectedCharacter,
  range: ActivityRange
) => Promise<LatestActivity>

export type CharacterActivityPorts = {
  fetchLatestActivity: FetchLatestActivity
  fetchBasic: FetchCharacterBasic
  readConcurrency: () => number
  now: () => Date
  pause: Pause
  report: (code: string, details: Readonly<Record<string, string | number>>) => void
}
