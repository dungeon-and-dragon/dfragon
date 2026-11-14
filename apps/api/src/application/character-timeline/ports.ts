import type { TimelineRange } from '@dfragon/database'
import type { CharacterIdentity } from '../../domain/character-identity.js'
import type { TimelineInputs } from '../../domain/character-timeline/rows.js'
import type { TimelineSyncQueue } from './queue.js'

export type FetchCharacterTimeline = (
  identity: CharacterIdentity,
  range: TimelineRange
) => Promise<TimelineInputs>

export type TimelineSyncWaiter = Pick<TimelineSyncQueue, 'requestAndWait'>
