import type { TimelineRange } from '@dfragon/database'
import type { CharacterIdentity } from '#domain/character-identity.js'
import type { TimelineInputs } from '#domain/character-timeline/index.js'

export type FetchCharacterTimeline = (
  identity: CharacterIdentity,
  range: TimelineRange
) => Promise<TimelineInputs>
