import { z } from 'zod'
import { storedCharacterSchema } from '#entities/ranking/@x/adventure-guild'

export const guildSchema = z.object({
  guildId: z.string(),
  guildName: z.string().nullable(),
  memberCount: z.number().int().nonnegative(),
  members: z.array(storedCharacterSchema)
})

export type Guild = z.infer<typeof guildSchema>

export const adventureCharactersSchema = z.object({
  adventureName: z.string(),
  characters: z.array(storedCharacterSchema)
})

export type AdventureCharacters = z.infer<typeof adventureCharactersSchema>
