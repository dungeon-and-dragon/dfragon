import { z } from 'zod'
import { storedCharacterSchema } from '../ranking/ranking-stats'

export const adventureCharactersSchema = z.object({
  adventureName: z.string(),
  characters: z.array(storedCharacterSchema)
})

export const guildSchema = z.object({
  guildId: z.string(),
  guildName: z.string().nullable(),
  memberCount: z.number().int().nonnegative(),
  averageFame: z.number().int().nullable(),
  members: z.array(storedCharacterSchema)
})

export type AdventureCharacters = z.infer<typeof adventureCharactersSchema>
export type Guild = z.infer<typeof guildSchema>
