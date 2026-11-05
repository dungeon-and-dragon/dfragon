import { isFiniteNumber, isNonblankString, isRecord } from '@dfragon/lib/utils/shape-check'

export type CharacterKey = { serverId: string; characterId: string }

export type CharacterDisplay = CharacterKey & {
  characterName: string
  adventureName: string
  jobGrowName: string
  fame: number
}

export function isSameCharacter(a: CharacterKey, b: CharacterKey): boolean {
  return a.serverId === b.serverId && a.characterId === b.characterId
}

export function pickCharacterDisplay(character: CharacterDisplay): CharacterDisplay {
  return {
    serverId: character.serverId,
    characterId: character.characterId,
    characterName: character.characterName,
    adventureName: character.adventureName,
    jobGrowName: character.jobGrowName,
    fame: character.fame
  }
}

export function refreshCharacterDisplay<T extends CharacterDisplay>(
  characters: T[],
  latest: CharacterDisplay
): T[] {
  return characters.map((character) => {
    if (!isSameCharacter(character, latest)) {
      return character
    }

    return { ...character, ...pickCharacterDisplay(latest) }
  })
}

export function isCharacterDisplay(value: unknown): value is CharacterDisplay {
  return (
    isRecord(value) &&
    isNonblankString(value.serverId) &&
    isNonblankString(value.characterId) &&
    isNonblankString(value.characterName) &&
    typeof value.adventureName === 'string' &&
    typeof value.jobGrowName === 'string' &&
    isFiniteNumber(value.fame)
  )
}

export function readStoredCharacters<T>(
  value: unknown,
  isCharacter: (value: unknown) => value is T
): T[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(isCharacter)
}
