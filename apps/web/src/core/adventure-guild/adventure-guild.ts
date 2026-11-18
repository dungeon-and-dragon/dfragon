import { z } from 'zod'
import { storedCharacterSchema } from '#core/ranking/ranking-stats'

export const guildSchema = z.object({
  guildId: z.string(),
  guildName: z.string().nullable(),
  memberCount: z.number().int().nonnegative(),
  averageFame: z.number().int().nullable(),
  members: z.array(storedCharacterSchema)
})

export type Guild = z.infer<typeof guildSchema>
