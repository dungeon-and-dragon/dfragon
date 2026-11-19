import { z } from 'zod'
import type { CharacterSearchQuery } from '#entities/character'
import { ALL_CHARACTER_SERVERS, characterSearchServerOptions } from '#shared/config/server-options'

const searchSchema = z.object({
  characterName: z.string().trim().catch(''),
  serverId: z
    .string()
    .refine((serverId) => characterSearchServerOptions.some((server) => server.id === serverId))
    .catch(ALL_CHARACTER_SERVERS)
})

export function parseCharacterSearch(search: Record<string, unknown>): CharacterSearchQuery {
  return searchSchema.parse(search)
}
