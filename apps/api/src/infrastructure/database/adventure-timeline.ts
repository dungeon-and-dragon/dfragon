import {
  type DatabaseClient,
  type RecentTimelineItemQuery,
  type StoredCharacter,
  type TimelineItemRow,
  readAdventureCharacters,
  readRecentTimelineItems
} from '@dfragon/database'
import {
  ENHANCEMENT_KINDS,
  TIMELINE_PAGE_SIZE,
  toAcquisition
} from '@dfragon/server-core/domain/character-timeline/index.js'
import type { AdventureTimelineRead } from '#application/adventure-guild/repository.js'
import {
  type AdventureTimelineCharacter,
  type AdventureTimelineEntry,
  type AdventureTimelineKind,
  type AdventureTimelineQuery,
  toAdventureTimelinePage
} from '#domain/adventure-guild/index.js'
import { PAGE_QUERIES, parseTimelineEnhancementRow } from './character-timeline-read.js'

type ItemFilter = Pick<RecentTimelineItemQuery, 'codes' | 'itemRarities'>

function toItemFilters(kind: AdventureTimelineKind | undefined): ItemFilter[] {
  if (kind === undefined) {
    return [PAGE_QUERIES.enhancements, PAGE_QUERIES.acquisitions]
  }

  if (kind === 'acquisition') {
    return [PAGE_QUERIES.acquisitions]
  }

  const codes = [...ENHANCEMENT_KINDS].filter(([, each]) => each === kind).map(([code]) => code)

  return [{ codes }]
}

export function toAdventureTimelineEntry(
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

    return { id, occurredAt, items }
  }

  const acquisition = toAcquisition(row)
  const item = { ...character, type: 'acquisition' as const, ...acquisition }

  return { id, occurredAt, items: [item] }
}

async function readCharacterEntries(
  client: DatabaseClient,
  { serverId, characterId, characterName }: StoredCharacter,
  filter: ItemFilter,
  before: AdventureTimelineQuery['before']
): Promise<AdventureTimelineEntry[]> {
  const character = { serverId, characterId, characterName }
  const rows = await readRecentTimelineItems(client, character, {
    ...filter,
    limit: TIMELINE_PAGE_SIZE + 1,
    before
  })

  return rows.map((row) => toAdventureTimelineEntry(character, row))
}

export async function readAdventureTimeline(
  client: DatabaseClient,
  adventureName: string,
  { kind, before }: AdventureTimelineQuery
): Promise<AdventureTimelineRead> {
  const characters = await readAdventureCharacters(client, adventureName)
  const filters = toItemFilters(kind)
  const entries = await Promise.all(
    characters.flatMap((character) =>
      filters.map((filter) => readCharacterEntries(client, character, filter, before))
    )
  )
  const page = toAdventureTimelinePage(entries.flat())

  return { characters, page }
}
