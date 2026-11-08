import { z } from 'zod'
import type { CharacterDetailView } from '#core/character/character-detail-view'
import { characterIdentitySchema, characterRole } from '#core/character/character-summary'

const text = z.string().nullable()
const count = z.number().nullable()

export const characterDisplaySchema = characterIdentitySchema.extend({
  characterName: z.string().refine((value) => value.trim().length > 0),
  adventureName: text,
  guildId: text,
  guildName: text,
  level: count,
  jobName: text,
  jobGrowName: text,
  fame: count,
  // role을 저장하기 전에 남긴 항목은 role이 없으므로 null로 읽는다.
  role: characterRole.catch(null)
})

export type CharacterKey = { serverId: string; characterId: string }

export type CharacterDisplay = z.infer<typeof characterDisplaySchema>

export function characterDisplayOf(detail: CharacterDetailView): CharacterDisplay | undefined {
  return characterDisplaySchema.safeParse({ ...detail.character, role: detail.card?.role }).data
}

export function isSameCharacter(a: CharacterKey, b: CharacterKey): boolean {
  return a.serverId === b.serverId && a.characterId === b.characterId
}

export function pickCharacterDisplay(character: CharacterDisplay): CharacterDisplay {
  return characterDisplaySchema.parse(character)
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

export function storedCharacterList<Item extends z.ZodType>(item: Item) {
  return z
    .array(z.unknown())
    .catch([])
    .transform((entries) =>
      entries.flatMap((entry) => {
        const parsed = item.safeParse(entry)
        if (!parsed.success) {
          return []
        }

        return [parsed.data]
      })
    )
}
