import { z } from 'zod'
import type { CharacterIdentity } from '../../preload/common/types/character'
import { SearchHttpFailure } from '../search/http'
import {
  CHARACTER_SERVER_NAMES as SERVER_NAMES,
  characterIdentitySchema as identitySchema,
  characterImageUrl
} from '../../preload/common/search/character-summary'

const MAX_CHARACTER_NAME_CODE_POINTS = 12
const MIN_SEARCH_NAME_CODE_POINTS = 2

export const ALL_CHARACTER_SERVERS = 'all'

const nonblank = z.string().refine((value) => value.trim().length > 0)
const candidateSchema = identitySchema
  .extend({
    characterName: nonblank,
    serverName: z.string(),
    fame: z.number().nullable(),
    imageUrl: z.string(),
    // API는 후보에 모험단명을 보내지 않고, 직업명을 보내기 전의 API와도 호환하도록 없으면 null로 받는다.
    adventureName: z.string().nullable().default(null),
    jobName: z.string().nullable().default(null),
    jobGrowName: z.string().nullable().default(null)
  })
  .refine(
    (candidate) =>
      candidate.serverName === SERVER_NAMES[candidate.serverId] &&
      candidate.imageUrl === characterImageUrl(candidate)
  )
export const candidatesSchema = z.object({ rows: z.array(candidateSchema) })

/** `serverId`가 `ALL_CHARACTER_SERVERS`면 모든 서버에서 찾는다. */
export type CharacterSearchQuery = Readonly<{ characterName: string; serverId: string }>
export type SearchedCharacter = z.output<typeof candidateSchema>
const sectionMetadataSchema = z.object({
  revision: z.number().int().positive(),
  contentUpdatedAt: z.iso.datetime(),
  lastSuccessfulFetchAt: z.iso.datetime()
})
export const detailsSchema = z
  .object({
    character: identitySchema
      .extend({ characterName: nonblank, serverName: z.string() })
      .catchall(z.json())
      .refine((character) => character.serverName === SERVER_NAMES[character.serverId]),
    status: z.object({ status: z.json(), buff: z.json() }),
    equipment: z.object({ equipment: z.json(), setItemInfo: z.json() }),
    avatar: z.json(),
    creature: z.json(),
    oath: z.json(),
    mistAssimilation: z.json(),
    skillStyle: z.json(),
    buff: z.object({ equipment: z.json(), avatar: z.json(), creature: z.json() }),
    sections: z.object({
      basic: sectionMetadataSchema,
      status: sectionMetadataSchema,
      equipment: sectionMetadataSchema,
      avatar: sectionMetadataSchema,
      creature: sectionMetadataSchema,
      oath: sectionMetadataSchema,
      mist_assimilation: sectionMetadataSchema,
      skill_style: sectionMetadataSchema,
      buff_equipment: sectionMetadataSchema,
      buff_avatar: sectionMetadataSchema,
      buff_creature: sectionMetadataSchema
    }),
    freshness: z.object({ lastSuccessfulFetchAt: z.iso.datetime(), expiresAt: z.iso.datetime() })
  })
  .catchall(z.json())

export function validateIdentity(identity: CharacterIdentity): void {
  if (!identitySchema.safeParse(identity).success) {
    throw new SearchHttpFailure('INVALID_SEARCH_QUERY')
  }
}

export function validateNickname(nickname: string): void {
  const length = Array.from(nickname).length
  if (length < 1 || length > MAX_CHARACTER_NAME_CODE_POINTS || nickname !== nickname.trim()) {
    throw new SearchHttpFailure('INVALID_SEARCH_QUERY')
  }
  try {
    encodeURIComponent(nickname)
  } catch {
    throw new SearchHttpFailure('INVALID_SEARCH_QUERY')
  }
}

export function isSearchableCharacterName(characterName: string): boolean {
  const length = Array.from(characterName).length

  return (
    length >= MIN_SEARCH_NAME_CODE_POINTS &&
    length <= MAX_CHARACTER_NAME_CODE_POINTS &&
    characterName === characterName.trim()
  )
}

export function validateSearchQuery({ characterName, serverId }: CharacterSearchQuery): void {
  const knownServer = serverId === ALL_CHARACTER_SERVERS || Object.hasOwn(SERVER_NAMES, serverId)
  if (!isSearchableCharacterName(characterName) || !knownServer) {
    throw new SearchHttpFailure('INVALID_SEARCH_QUERY')
  }
  validateNickname(characterName)
}
