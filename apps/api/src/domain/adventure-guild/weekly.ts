import type { StoredCharacter, TimelineCharacter } from '@dfragon/database'
import { type CharacterRow, toCharacterRow } from '../character-row.js'
import type { TimelineClear } from '../character-timeline/project.js'

type WeeklyClearRecord = { serverId: string; characterId: string; clears: TimelineClear[] }

// 열 이름은 Neople 타임라인의 raidName, regionName과 글자까지 같아야 클리어로 센다.
const WEEKLY_CLEAR_NAMES: readonly ClearName[] = [
  { kind: 'raid', name: '디레지에 레이드' },
  { kind: 'raid', name: '무너진 성자 미카엘라' },
  { kind: 'legion', name: '아포칼립스' }
]

export type ClearName = Pick<TimelineClear, 'kind' | 'name'>

export type WeeklyCharacter = CharacterRow & { weeklyClears: ClearName[] }

export type AdventureWeeklyClears = {
  clearNames: ClearName[]
  characters: WeeklyCharacter[]
}

function characterKey({ serverId, characterId }: TimelineCharacter): string {
  return `${serverId}/${characterId}`
}

export function toAdventureWeeklyClears(
  characters: readonly StoredCharacter[],
  events: readonly WeeklyClearRecord[],
  weekStart: Date
): AdventureWeeklyClears {
  const weeklyClears = new Map<string, TimelineClear[]>()
  for (const event of events) {
    const character = characterKey(event)
    for (const clear of event.clears) {
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

    const row = toCharacterRow(character)

    return { ...row, weeklyClears: characterClears }
  })

  const clearNames = [...WEEKLY_CLEAR_NAMES]

  return { clearNames, characters: weeklyCharacters }
}
