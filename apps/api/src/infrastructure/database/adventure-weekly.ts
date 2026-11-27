import {
  type CharacterTimelineEventRow,
  type DatabaseClient,
  type RankedStoredCharacter,
  readAdventureSetCharacters,
  readCharactersTimelineEvents
} from '@dfragon/database'
import {
  type AdventureWeeklyClears,
  toAdventureWeeklyClears
} from '#domain/adventure-guild/index.js'
import { CLEAR_CODES } from '@dfragon/server-core/domain/character-timeline/index.js'
import { startOfResetWeek } from '@dfragon/server-core/domain/seoul-time.js'
import { parseTimelineClearRow } from './timeline-rows.js'

export function parseAdventureWeeklyClears(
  characters: readonly RankedStoredCharacter[],
  events: readonly CharacterTimelineEventRow[],
  weekStart: Date
): AdventureWeeklyClears {
  const records = events.map((event) => {
    const clears = parseTimelineClearRow(event)

    return { ...event, clears }
  })

  return toAdventureWeeklyClears(characters, records, weekStart)
}

export async function readAdventureWeeklyClears(
  client: DatabaseClient,
  adventureName: string,
  now: Date
): Promise<AdventureWeeklyClears> {
  const weekStart = startOfResetWeek(now)
  const characters = await readAdventureSetCharacters(client, adventureName)
  const events = await readCharactersTimelineEvents(client, characters, CLEAR_CODES, weekStart)

  return parseAdventureWeeklyClears(characters, events, weekStart)
}
