import type {
  TimelineCharacter,
  TimelineItemCursor,
  TimelineQueueCount,
  TimelineRange
} from '@dfragon/database'
import type { CharacterIdentity } from '../../domain/character-identity.js'
import type { TimelineInputs } from '../../domain/character-timeline/rows.js'
import type { TimelineItemPage, TimelinePageList } from '../../domain/character-timeline/project.js'

export type FetchCharacterTimeline = (
  identity: CharacterIdentity,
  range: TimelineRange
) => Promise<TimelineInputs>

export type ReadTimelinePage = (
  character: TimelineCharacter,
  list: TimelinePageList,
  before: TimelineItemCursor
) => Promise<TimelineItemPage>

export type WriteQueueCounts = (counts: readonly TimelineQueueCount[]) => Promise<void>
