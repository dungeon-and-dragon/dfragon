import type { z } from 'zod'
import {
  type CharacterIdentity,
  characterDetailViewSchema,
  validateIdentity
} from '#entities/character/@x/character-detail'
import { createJsonRequest } from '#shared/api/json-request'
import { API_BASE_URL, dfragonHttp } from '#shared/api/dfragon-api'

const requestJson = createJsonRequest(dfragonHttp, API_BASE_URL)

type JsonRequestOptions = Parameters<typeof requestJson>[2]

export function characterPath({ serverId, characterId }: CharacterIdentity): string {
  return `/characters/${serverId}/${characterId}`
}

export async function requestCharacterJson<Schema extends z.ZodType>(
  identity: CharacterIdentity,
  path: string,
  schema: Schema,
  options?: JsonRequestOptions
): Promise<z.infer<Schema>> {
  validateIdentity(identity)

  return requestJson(`${characterPath(identity)}${path}`, schema, options)
}

export function detailViewSchemaOf({ serverId, characterId }: CharacterIdentity) {
  return characterDetailViewSchema.refine(
    ({ character }) => character.serverId === serverId && character.characterId === characterId
  )
}
