import type { TimelineItemCursor } from '@dfragon/database'
import {
  type EnhancementKind,
  TIMELINE_PAGE_SIZE,
  type TimelineAcquisition,
  type TimelineEnhancement,
  formatTimelineCursor
} from '@dfragon/server-core/domain/character-timeline/index.js'

export type AdventureTimelineKind = EnhancementKind | 'acquisition'

export const ADVENTURE_TIMELINE_KINDS = [
  'reinforce',
  'amplify',
  'refine',
  'acquisition'
] as const satisfies readonly AdventureTimelineKind[]

export type AdventureTimelineQuery = {
  kind?: AdventureTimelineKind
  before?: TimelineItemCursor
}

export type AdventureTimelineCharacter = {
  serverId: string
  characterId: string
  characterName: string
}

export type AdventureTimelineItem = AdventureTimelineCharacter &
  (
    | ({ type: 'enhancement' } & TimelineEnhancement)
    | ({ type: 'acquisition' } & TimelineAcquisition)
  )

export type AdventureTimelinePage = {
  items: AdventureTimelineItem[]
  nextCursor: string | null
}

// 읽은 행 하나다. 형식이 맞지 않아 뺀 강화 행도 cursor를 정하려고 빈 items로 남긴다.
export type AdventureTimelineEntry = TimelineItemCursor & {
  items: AdventureTimelineItem[]
}

// 캐릭터 타임라인 목록과 같은 순서(시각 내림차순, 같은 시각이면 id 오름차순)로 합친다.
function compareEntries(left: TimelineItemCursor, right: TimelineItemCursor): number {
  const byTime = right.occurredAt.getTime() - left.occurredAt.getTime()

  if (byTime !== 0) {
    return byTime
  }

  if (left.id === right.id) {
    return 0
  }

  if (left.id < right.id) {
    return -1
  }

  return 1
}

// 캐릭터마다 cursor 뒤로 한 묶음보다 하나 더 읽은 행을 합쳐, 모험단 전체에서 다음 묶음이 있는지 본다.
export function toAdventureTimelinePage(
  entries: readonly AdventureTimelineEntry[]
): AdventureTimelinePage {
  const sorted = entries.toSorted(compareEntries)
  const page = sorted.slice(0, TIMELINE_PAGE_SIZE)
  const last = page.at(-1)
  const items = page.flatMap((entry) => entry.items)
  const nextCursor =
    sorted.length > TIMELINE_PAGE_SIZE && last !== undefined ? formatTimelineCursor(last) : null

  return { items, nextCursor }
}
