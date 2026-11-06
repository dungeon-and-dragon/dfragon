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

// 열 이름은 Neople 타임라인의 raidName, regionName과 글자까지 같아야 클리어로 센다.
const WEEKLY_CLEAR_NAMES: readonly ClearName[] = [
  { kind: 'raid', name: '디레지에 레이드' },
  { kind: 'raid', name: '무너진 성자 미카엘라' },
  { kind: 'legion', name: '아포칼립스' }
]

export type ClearName = Pick<TimelineClear, 'kind' | 'name'>

export type WeeklyCharacter = StoredCharacter & { weeklyClears: ClearName[] }

export type AdventureWeeklyClears = {
  clearNames: ClearName[]
  characters: WeeklyCharacter[]
}

function characterKey({ serverId, characterId }: TimelineCharacter): string {
  return `${serverId}/${characterId}`
}

export function toAdventureWeeklyClears(
  characters: readonly StoredCharacter[],
  events: readonly CharacterTimelineEventRow[],
  weekStart: Date
): AdventureWeeklyClears {
  const weeklyClears = new Map<string, TimelineClear[]>()
  for (const event of events) {
    const character = characterKey(event)
    for (const clear of toClear(event)) {
      if (clear.occurredAt >= weekStart) {
        weeklyClears.set(character, [...(weeklyClears.get(character) ?? []), clear])
      }
    }
  }

  const weeklyCharacters = characters.map((character) => {
    const clears = weeklyClears.get(characterKey(character)) ?? []
    const characterClears = WEEKLY_CLEAR_NAMES.filter((clearName) =>
      clears.some(({ kind, name }) => kind === clearName.kind && name === clearName.name)
    )

    return { ...character, weeklyClears: characterClears }
  })

  const clearNames = [...WEEKLY_CLEAR_NAMES]

  return { clearNames, characters: weeklyCharacters }
}

export async function readAdventureWeeklyClears(
  client: DatabaseClient,
  adventureName: string,
  now: Date
): Promise<AdventureWeeklyClears> {
  const weekStart = startOfResetWeek(now)
  const characters = await readAdventureCharacters(client, adventureName)
  const events = await readCharactersTimelineEvents(client, characters, CLEAR_CODES, weekStart)

  return toAdventureWeeklyClears(characters, events, weekStart)
}
