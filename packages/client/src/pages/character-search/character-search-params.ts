import { z } from 'zod'
import {
  ALL_CHARACTER_SERVERS,
  type CharacterSearchQuery
} from '@dfragon/client-core/shared/search/character-http'
import { characterSearchServerOptions } from '../../constants/server-options'

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
