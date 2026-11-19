import { z } from 'zod'
import type {
  CharacterCandidate,
  CharacterDetails,
  CharacterIdentity
} from '#core/character/character'
import { SearchHttpFailure } from './http'
import {
  assertApiSuccess,
  createCharacterHttpClient,
  parseCharacterJson,
  throwCharacterTransportFailure
} from './api-response'
import {
  candidatesSchema,
  detailsSchema,
  validateIdentity,
  validateNickname
} from './character-schemas'

export type IdentityRequest = CharacterIdentity & { signal: AbortSignal }
export type CharacterCandidatesHttp = (input: {
  nickname: string
  signal: AbortSignal
}) => Promise<readonly CharacterCandidate[]>
export type CharacterPngHttp = (input: IdentityRequest) => Promise<Uint8Array>
export type CharacterDetailsHttp = (input: IdentityRequest) => Promise<CharacterDetails>
export type DfragonClient = Readonly<{
  characters: Readonly<{
    candidates: CharacterCandidatesHttp
    image: CharacterPngHttp
    details: CharacterDetailsHttp
  }>
}>

type JsonRequestOptions = {
  method?: 'get' | 'post'
  searchParams?: Record<string, string>
  signal?: AbortSignal
  details?: boolean
  timeout?: number
}

function characterPath({ serverId, characterId }: CharacterIdentity): string {
  return `/characters/${serverId}/${characterId}`
}

function sameIdentity(
  character: CharacterIdentity,
  { serverId, characterId }: CharacterIdentity
): boolean {
  return character.serverId === serverId && character.characterId === characterId
}

export function createJsonRequest(
  http: ReturnType<typeof createCharacterHttpClient>,
  apiOrigin: string
): <Schema extends z.ZodType>(
  path: string,
  schema: Schema,
  options?: JsonRequestOptions
) => Promise<z.infer<Schema>> {
  return async (
    path,
    schema,
    { method = 'get', searchParams, signal, details = true, timeout } = {}
  ) => {
    try {
      signal?.throwIfAborted()
      const request = http(`${apiOrigin}${path}`, {
        method,
        searchParams,
        headers: { Accept: 'application/json' },
        signal,
        timeout
      })
      const response = await request
      // ky의 body 메서드만 본문 읽기에도 timeout을 건다. await한 Response의 본문을 직접 읽으면 대기 상한이 없다.
      const body = parseCharacterJson(await request.arrayBuffer())
      assertApiSuccess(response, body, details)
      const parsed = schema.safeParse(body)
      if (!parsed.success) {
        throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
      }
      signal?.throwIfAborted()

      return parsed.data
    } catch (error) {
      throwCharacterTransportFailure(error, signal)
    }
  }
}

export function createDfragonClient({
  apiOrigin,
  fetch: transport
}: {
  apiOrigin: string
  fetch: typeof fetch
}): DfragonClient {
  const http = createCharacterHttpClient(transport)
  const requestJson = createJsonRequest(http, apiOrigin)

  async function image({ serverId, characterId, signal }: IdentityRequest): Promise<Uint8Array> {
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

  return {
    characters: {
      async candidates({ nickname, signal }) {
        validateNickname(nickname)
        const { rows } = await requestJson(
          '/characters/candidates',
          candidatesSchema.refine(({ rows }) =>
            rows.every((row) => row.characterName === nickname)
          ),
          { searchParams: { characterName: nickname }, signal, details: false }
        )

        return rows
      },
      image,
      async details({ serverId, characterId, signal }) {
        const identity = { serverId, characterId }
        validateIdentity(identity)

        return requestJson(
          characterPath(identity),
          detailsSchema.refine(({ character }) => sameIdentity(character, identity)),
          { signal }
        )
      }
    }
  }
}
