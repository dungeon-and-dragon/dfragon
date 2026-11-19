import type { KyInstance } from 'ky'
import {
  type CharacterCandidate,
  type CharacterDetails,
  type CharacterIdentity,
  candidatesSchema,
  detailsSchema,
  validateIdentity,
  validateNickname
} from '#entities/character'
import { SearchHttpFailure } from '#shared/api/api-error'
import { throwCharacterTransportFailure } from '#shared/api/api-response'
import { createJsonRequest } from '#shared/api/json-request'

export type CharacterApi = Readonly<{ http: KyInstance; apiOrigin: string }>

export type IdentityRequest = CharacterIdentity & { signal: AbortSignal }
export type CharacterCandidatesHttp = (input: {
  nickname: string
  signal: AbortSignal
}) => Promise<readonly CharacterCandidate[]>
export type CharacterDetailsHttp = (input: IdentityRequest) => Promise<CharacterDetails>

function characterPath({ serverId, characterId }: CharacterIdentity): string {
  return `/characters/${serverId}/${characterId}`
}

function sameIdentity(
  character: CharacterIdentity,
  { serverId, characterId }: CharacterIdentity
): boolean {
  return character.serverId === serverId && character.characterId === characterId
}

export async function requestCharacterCandidates(
  { http, apiOrigin }: CharacterApi,
  { nickname, signal }: { nickname: string; signal: AbortSignal }
): Promise<readonly CharacterCandidate[]> {
  validateNickname(nickname)
  const { rows } = await createJsonRequest(http, apiOrigin)(
    '/characters/candidates',
    candidatesSchema.refine(({ rows }) => rows.every((row) => row.characterName === nickname)),
    { searchParams: { characterName: nickname }, signal, details: false }
  )

  return rows
}

export async function requestCharacterImage(
  { http, apiOrigin }: CharacterApi,
  { serverId, characterId, signal }: IdentityRequest
): Promise<Uint8Array> {
  const identity = { serverId, characterId }
  validateIdentity(identity)

  try {
    signal.throwIfAborted()
    const request = http.get(`${apiOrigin}${characterPath(identity)}/image`, {
      headers: { Accept: 'image/png' },
      signal
    })
    const response = await request
    if (response.status !== 200) {
      await response.body?.cancel().catch(() => undefined)
      if (response.status === 429) {
        throw new SearchHttpFailure('SEARCH_RATE_LIMITED')
      }
      throw new SearchHttpFailure('NEOPLE_API_ERROR')
    }
    // ky의 body 메서드만 본문 읽기에도 timeout을 건다.
    const bytes = new Uint8Array(await request.arrayBuffer())
    const contentType = response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()
    if (contentType !== 'image/png') {
      throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
    }
    signal.throwIfAborted()

    return bytes
  } catch (error) {
    throwCharacterTransportFailure(error, signal)
  }
}

export async function requestCharacterDetails(
  { http, apiOrigin }: CharacterApi,
  { serverId, characterId, signal }: IdentityRequest
): Promise<CharacterDetails> {
  const identity = { serverId, characterId }
  validateIdentity(identity)

  return createJsonRequest(http, apiOrigin)(
    characterPath(identity),
    detailsSchema.refine(({ character }) => sameIdentity(character, identity)),
    { signal }
  )
}
