import type { TimelineItemCursor } from '@dfragon/database'
import {
  TIMELINE_PAGE_SIZE,
  type TimelineAcquisition,
  type TimelineClear,
  type TimelineEnhancement
} from '@dfragon/server-core/domain/character-timeline/index.js'

export const ADVENTURE_TIMELINE_KINDS = ['enhancement', 'acquisition', 'clear'] as const

export type AdventureTimelineKind = (typeof ADVENTURE_TIMELINE_KINDS)[number]

// 강화, 획득은 timeline_items, 클리어는 timeline_events에 있어 id가 서로 다른 순번이다.
const SOURCES = ['item', 'event'] as const

export type AdventureTimelineSource = (typeof SOURCES)[number]

export type AdventureTimelineCursor = TimelineItemCursor & { source: AdventureTimelineSource }

export type AdventureTimelineQuery = {
  kind?: AdventureTimelineKind
  before?: AdventureTimelineCursor
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
    | ({ type: 'clear' } & TimelineClear)
  )

export type AdventureTimelinePage = {
  items: AdventureTimelineItem[]
  nextCursor: string | null
}

// 읽은 행 하나다. 형식이 맞지 않아 뺀 행도 cursor를 정하려고 빈 items로 남긴다.
export type AdventureTimelineEntry = AdventureTimelineCursor & {
  items: AdventureTimelineItem[]
}

const SOURCE_ORDER = { item: 0, event: 1 } as const satisfies Record<
  AdventureTimelineSource,
  number
>
// 18자리 id는 PostgreSQL bigint 범위를 넘지 않는다.
const CURSOR_PATTERN = /^(\d{1,15})\.([01])\.(\d{1,18})$/
const NO_ID = -1n
const ALL_IDS = 2n ** 63n - 1n

// 시각 내림차순, 같은 시각이면 강화와 획득을 클리어보다 앞에 두고, 같은 테이블은 캐릭터 타임라인처럼 id 오름차순이다.
function compareEntries(left: AdventureTimelineCursor, right: AdventureTimelineCursor): number {
  const byTime = right.occurredAt.getTime() - left.occurredAt.getTime()

  if (byTime !== 0) {
    return byTime
  }

  const bySource = SOURCE_ORDER[left.source] - SOURCE_ORDER[right.source]

  if (bySource !== 0) {
    return bySource
  }

  if (left.id === right.id) {
    return 0
  }

  if (left.id < right.id) {
    return -1
  }

  return 1
}

export function formatAdventureTimelineCursor({
  occurredAt,
  source,
  id
}: AdventureTimelineCursor): string {
  return `${occurredAt.getTime()}.${SOURCE_ORDER[source]}.${id}`
}

export function parseAdventureTimelineCursor(cursor: string): AdventureTimelineCursor | undefined {
  const match = CURSOR_PATTERN.exec(cursor)

  if (match === null) {
    return undefined
  }

  const occurredAt = new Date(Number(match[1]))
  const source = SOURCES[Number(match[2])]!
  const id = BigInt(match[3]!)

  return { occurredAt, source, id }
}

// 한 테이블을 읽을 cursor로 바꾼다. 같은 시각의 행 가운데 cursor보다 앞 테이블 행은 이미 보였고 뒤 테이블 행은 아직 보이지 않았다.
export function toSourceCursor(
  cursor: AdventureTimelineCursor,
  source: AdventureTimelineSource
): TimelineItemCursor {
  const { occurredAt } = cursor
  const order = SOURCE_ORDER[source] - SOURCE_ORDER[cursor.source]

  if (order === 0) {
    return { occurredAt, id: cursor.id }
  }

  if (order < 0) {
    return { occurredAt, id: ALL_IDS }
  }

  return { occurredAt, id: NO_ID }
}

// 캐릭터, 테이블마다 cursor 뒤로 한 묶음보다 하나 더 읽은 행을 합쳐, 모험단 전체에서 다음 묶음이 있는지 본다.
export function toAdventureTimelinePage(
  entries: readonly AdventureTimelineEntry[]
): AdventureTimelinePage {
  const sorted = entries.toSorted(compareEntries)
  const page = sorted.slice(0, TIMELINE_PAGE_SIZE)
  const last = page.at(-1)
  const items = page.flatMap((entry) => entry.items)
  const nextCursor =
    sorted.length > TIMELINE_PAGE_SIZE && last !== undefined
      ? formatAdventureTimelineCursor(last)
      : null

  return { items, nextCursor }
}
