import {
  type NeopleImageClient,
  NeopleRequestFailure,
  createNeopleImageClient
} from '@dfragon/neople'
import { forwardCause } from '../../error-chain.js'
import { CharacterDetailFailure } from '../details/errors.js'
import type { CharacterIdentity } from '../identity.js'

export type FetchCharacterImage = (
  identity: CharacterIdentity,
  signal: AbortSignal
) => Promise<Buffer>

export function createNeopleCharacterImage(
  images: NeopleImageClient = createNeopleImageClient()
): FetchCharacterImage {
  return async (identity, signal) => {
    try {
      return Buffer.from(await images.characterImage(identity, signal))
    } catch (error) {
      if (error instanceof NeopleRequestFailure && error.kind === 'timeout') {
        throw new CharacterDetailFailure('timeout')
      }

      if (signal.aborted) {
        throw new CharacterDetailFailure('internal')
      }

      if (error instanceof NeopleRequestFailure) {
        throw new CharacterDetailFailure(error.kind, forwardCause(error))
      }
      throw new CharacterDetailFailure('api', { cause: error })
    }
  }
}
