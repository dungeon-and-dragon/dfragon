import {
  type CharacterTimelineEventRow,
  type DatabaseClient,
  type StoredCharacter,
  type TimelineCharacter,
  readAdventureCharacters,
  readCharactersTimelineEvents
} from '@dfragon/database'
import { CLEAR_CODES, type TimelineClear, toClear } from '../characters/timeline/read.js'
import { startOfResetWeek } from '../utils/seoul-time.js'

// 한국은 서머타임이 없어 한 주를 고정 길이로 빼도 목요일 06:00이 어긋나지 않는다.
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const CLEAR_NAME_WEEKS = 4
const KIND_ORDER: readonly TimelineClear['kind'][] = ['raid', 'legion']

export type ClearName = Pick<TimelineClear, 'kind' | 'name'>

export type WeeklyCharacter = StoredCharacter & { weeklyClears: ClearName[] }

export type AdventureWeeklyClears = {
  clearNames: ClearName[]
  characters: WeeklyCharacter[]
}

function characterKey({ serverId, characterId }: TimelineCharacter): string {
  return `${serverId}/${characterId}`
}

function compareClearNames(left: ClearName, right: ClearName): number {
  const kindOrder = KIND_ORDER.indexOf(left.kind) - KIND_ORDER.indexOf(right.kind)
  if (kindOrder !== 0) {
    return kindOrder
  }

  return left.name.localeCompare(right.name, 'ko')
}

function uniqueClearNames(clears: readonly ClearName[]): ClearName[] {
  const names = new Map<string, ClearName>()
  for (const { kind, name } of clears) {
    names.set(`${kind}/${name}`, { kind, name })
  }

  return [...names.values()].toSorted(compareClearNames)
}

export function toAdventureWeeklyClears(
  characters: readonly StoredCharacter[],
  events: readonly CharacterTimelineEventRow[],
  weekStart: Date
): AdventureWeeklyClears {
  const clears = events.flatMap((event) =>
    toClear(event).map((clear) => ({ character: characterKey(event), clear }))
  )
  const weeklyClears = new Map<string, TimelineClear[]>()
  for (const { character, clear } of clears) {
    if (clear.occurredAt >= weekStart) {
      weeklyClears.set(character, [...(weeklyClears.get(character) ?? []), clear])
    }
  }

  const clearNames = uniqueClearNames(clears.map(({ clear }) => clear))
  const weeklyCharacters = characters.map((character) => {
    const characterClears = uniqueClearNames(weeklyClears.get(characterKey(character)) ?? [])

    return { ...character, weeklyClears: characterClears }
  })

  return { clearNames, characters: weeklyCharacters }
}

export async function readAdventureWeeklyClears(
  client: DatabaseClient,
  adventureName: string,
  now: Date
): Promise<AdventureWeeklyClears> {
  const weekStart = startOfResetWeek(now)
  const since = new Date(weekStart.getTime() - (CLEAR_NAME_WEEKS - 1) * WEEK_MS)
  const characters = await readAdventureCharacters(client, adventureName)
  const events = await readCharactersTimelineEvents(client, characters, CLEAR_CODES, since)

  return toAdventureWeeklyClears(characters, events, weekStart)
}
