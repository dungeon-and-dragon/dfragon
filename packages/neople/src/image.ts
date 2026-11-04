import ky, { isTimeoutError } from 'ky'
import type { NeopleCharacterIdentity, NeopleTestDependencies } from './client.js'
import { NeopleRequestFailure, neopleStatusFailureKind } from './failure.js'
import type { FetchTransport } from './transport.js'

const NEOPLE_IMAGE_ORIGIN = 'https://img-api.neople.co.kr'
// Desktop이 같은 초상화를 직접 받을 때의 상한(CHARACTER_IMAGE_LIMITS.imageBytes)과 같다.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024

export function neopleCharacterImageUrl({
  serverId,
  characterId
}: NeopleCharacterIdentity): string {
  return `${NEOPLE_IMAGE_ORIGIN}/df/servers/${encodeURIComponent(serverId)}/characters/${encodeURIComponent(characterId)}?zoom=1`
}

/** 이미지 서버는 API key를 받지 않으므로 key header 없이 부른다. */
function makeImageClient(fetch: FetchTransport | undefined) {
  const images = ky.create({
    fetch,
    redirect: 'error',
    retry: 0,
    throwHttpErrors: false,
    maxResponseSize: MAX_IMAGE_BYTES
  })

  return {
    async characterImage(
      identity: NeopleCharacterIdentity,
      signal: AbortSignal
    ): Promise<ArrayBuffer> {
      try {
        signal.throwIfAborted()
        const request = images.get(neopleCharacterImageUrl(identity), {
          headers: { Accept: 'image/png' },
          signal
        })
        const response = await request
        if (!response.ok) {
          await response.body?.cancel().catch(() => undefined)
          throw new NeopleRequestFailure(neopleStatusFailureKind(response.status))
        }
        const contentType = response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()
        if (contentType !== 'image/png') {
          await response.body?.cancel().catch(() => undefined)
          throw new NeopleRequestFailure('api')
        }

        // ky의 body 메서드만 본문 읽기에도 timeout과 크기 상한을 건다.

        return await request.arrayBuffer()
      } catch (error) {
        if (error instanceof NeopleRequestFailure) {
          throw error
        }

        if (isTimeoutError(error)) {
          throw new NeopleRequestFailure('timeout')
        }
        throw new NeopleRequestFailure('api', { cause: error })
      }
    }
  }
}

export type NeopleImageClient = ReturnType<typeof makeImageClient>

export function createNeopleImageClient(): NeopleImageClient {
  return makeImageClient(undefined)
}

export function createNeopleImageClientForTest(
  deps: Pick<NeopleTestDependencies, 'fetch'>
): NeopleImageClient {
  return makeImageClient(deps.fetch)
}
