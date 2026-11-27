import {
  type DatabaseClient,
  type RecentTimelineEventRow,
  type RecentTimelineItemQuery,
  type StoredCharacter,
  type TimelineItemRow,
  readAdventureCharacters,
  readRecentTimelineEvents,
  readRecentTimelineItems
} from '@dfragon/database'
import {
  ACQUISITION_CODES,
  ENHANCEMENT_KINDS,
  RAID_CLEAR_CODES,
  TIMELINE_PAGE_SIZE,
  toAcquisition
} from '@dfragon/server-core/domain/character-timeline/index.js'
import type { AdventureTimelineRead } from '#application/adventure-guild/repository.js'
import {
  type AdventureTimelineCharacter,
  type AdventureTimelineCursor,
  type AdventureTimelineEntry,
  type AdventureTimelineKind,
  type AdventureTimelineQuery,
  toAdventureTimelinePage,
  toSourceCursor
} from '#domain/adventure-guild/index.js'
import { parseTimelineClearRow, parseTimelineEnhancementRow } from './timeline-rows.js'

type ItemFilter = Pick<RecentTimelineItemQuery, 'codes' | 'itemRarities'>

export type TimelineRead =
  | { source: 'item'; filter: ItemFilter }
  | { source: 'event'; codes: readonly number[] }

// 재련은 모험단 타임라인에 넣지 않는다(2026-11-22 저장소 소유자 결정).
const ENHANCEMENT_CODES = [...ENHANCEMENT_KINDS]
  .filter(([, kind]) => kind !== 'refine')
  .map(([code]) => code)

const ACQUISITION_FILTER = { codes: ACQUISITION_CODES, itemRarities: ['에픽', '태초'] }

const READS = {
  enhancement: { source: 'item', filter: { codes: ENHANCEMENT_CODES } },
  acquisition: { source: 'item', filter: ACQUISITION_FILTER },
  clear: { source: 'event', codes: RAID_CLEAR_CODES }
} as const satisfies Record<AdventureTimelineKind, TimelineRead>

export function toTimelineReads(kind: AdventureTimelineKind | undefined): TimelineRead[] {
  if (kind === undefined) {
    return Object.values(READS)
  }

  return [READS[kind]]
}

export function toAdventureTimelineItemEntry(
  character: AdventureTimelineCharacter,
  row: TimelineItemRow
): AdventureTimelineEntry {
  const { id, occurredAt } = row

  if (ENHANCEMENT_KINDS.has(row.code)) {
    const items = parseTimelineEnhancementRow(row).map((enhancement) => ({
      ...character,
      type: 'enhancement' as const,
      ...enhancement
    }))

    return { source: 'item', id, occurredAt, items }
  }

  const acquisition = toAcquisition(row)
  const item = { ...character, type: 'acquisition' as const, ...acquisition }

  return { source: 'item', id, occurredAt, items: [item] }
}

export function toAdventureTimelineEventEntry(
  character: AdventureTimelineCharacter,
  row: RecentTimelineEventRow
): AdventureTimelineEntry {
  const { id, occurredAt } = row
  const items = parseTimelineClearRow(row).map((clear) => ({
    ...character,
    type: 'clear' as const,
    ...clear
  }))

  return { source: 'event', id, occurredAt, items }
}

async function readCharacterEntries(
  client: DatabaseClient,
  { serverId, characterId, characterName }: StoredCharacter,
  read: TimelineRead,
  cursor: AdventureTimelineCursor | undefined
): Promise<AdventureTimelineEntry[]> {
  const character = { serverId, characterId, characterName }
  const before = cursor && toSourceCursor(cursor, read.source)
  const limit = TIMELINE_PAGE_SIZE + 1

  if (read.source === 'event') {
    const rows = await readRecentTimelineEvents(client, character, {
      codes: read.codes,
      limit,
      before
    })

    return rows.map((row) => toAdventureTimelineEventEntry(character, row))
  }

  const rows = await readRecentTimelineItems(client, character, { ...read.filter, limit, before })

  return rows.map((row) => toAdventureTimelineItemEntry(character, row))
}

export async function readAdventureTimeline(
  client: DatabaseClient,
  adventureName: string,
  { kind, before }: AdventureTimelineQuery
): Promise<AdventureTimelineRead> {
  const characters = await readAdventureCharacters(client, adventureName)
  const reads = toTimelineReads(kind)
  const entries = await Promise.all(
    characters.flatMap((character) =>
      reads.map((read) => readCharacterEntries(client, character, read, before))
    )
  )
  const page = toAdventureTimelinePage(entries.flat())

  return { characters, page }
}
