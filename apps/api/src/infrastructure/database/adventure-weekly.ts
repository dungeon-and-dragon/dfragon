import {
  type CharacterTimelineEventRow,
  type DatabaseClient,
  type StoredCharacter,
  readAdventureCharacters,
  readCharactersTimelineEvents
} from '@dfragon/database'
import {
  type AdventureWeeklyClears,
  toAdventureWeeklyClears
} from '../../domain/adventure-guild/weekly.js'
import { CLEAR_CODES } from '../../domain/character-timeline/project.js'
import { startOfResetWeek } from '../../domain/seoul-time.js'
import { parseTimelineClearRow } from './character-timeline-read.js'

export function parseAdventureWeeklyClears(
  characters: readonly StoredCharacter[],
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
  const characters = await readAdventureCharacters(client, adventureName)
  const events = await readCharactersTimelineEvents(client, characters, CLEAR_CODES, weekStart)

  return parseAdventureWeeklyClears(characters, events, weekStart)
}
