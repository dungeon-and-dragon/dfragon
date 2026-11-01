import ky, { isTimeoutError } from 'ky'
import { neopleStatusFailureKind } from '../../errors/neople-search.js'
import type { FetchTransport } from '../../types/neople-character-search.js'
import { CharacterDetailFailure } from '../details/errors.js'
import type { CharacterIdentity } from '../identity.js'

const NEOPLE_IMAGE_ORIGIN = 'https://img-api.neople.co.kr'
// Desktop이 같은 초상화를 직접 받을 때의 상한(CHARACTER_IMAGE_LIMITS.imageBytes)과 같다.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024

export type FetchCharacterImage = (
  identity: CharacterIdentity,
  signal: AbortSignal
) => Promise<Buffer>

export function neopleCharacterImageUrl({ serverId, characterId }: CharacterIdentity): string {
  return `${NEOPLE_IMAGE_ORIGIN}/df/servers/${encodeURIComponent(serverId)}/characters/${encodeURIComponent(characterId)}?zoom=1`
}

/** 이미지 서버는 API key를 받지 않으므로 key header 없이 부른다. */
export function createNeopleCharacterImage(
  deps: { fetch?: FetchTransport } = {}
): FetchCharacterImage {
  const neople = ky.create({
    fetch: deps.fetch,
    redirect: 'error',
    retry: 0,
    throwHttpErrors: false,
    maxResponseSize: MAX_IMAGE_BYTES
  })

  return async (identity, signal) => {
    try {
      signal.throwIfAborted()
      const request = neople.get(neopleCharacterImageUrl(identity), {
        headers: { Accept: 'image/png' },
        signal
      })
      const response = await request
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined)
        throw new CharacterDetailFailure(neopleStatusFailureKind(response.status))
      }
      const contentType = response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()
      if (contentType !== 'image/png') {
        await response.body?.cancel().catch(() => undefined)
        throw new CharacterDetailFailure('api')
      }

      // ky의 body 메서드만 본문 읽기에도 timeout과 크기 상한을 건다.
      const image = await request.arrayBuffer()

      return Buffer.from(image)
    } catch (error) {
      if (isTimeoutError(error)) {
        throw new CharacterDetailFailure('timeout')
      }

      if (signal.aborted) {
        throw new CharacterDetailFailure('internal')
      }

      if (error instanceof CharacterDetailFailure) {
        throw error
      }
      throw new CharacterDetailFailure('api', { cause: error })
    }
  }
}
