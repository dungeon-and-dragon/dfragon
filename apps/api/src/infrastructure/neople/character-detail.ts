import { type NeopleCharacter, type NeopleClient, NeopleRequestFailure } from '@dfragon/neople'
import { elapsedMs } from '../../application/character-detail/neople-stages.js'
import type { FetchCharacterDetails } from '../../application/character-detail/ports.js'
import { characterDetailSections } from '../../domain/character-detail/sections.js'
import type {
  CharacterDetailSection,
  CharacterIdentity,
  CharacterPayload,
  CharacterPayloads
} from '../../domain/character-detail/sections.js'
import { CharacterDetailFailure } from '../../domain/character-failure.js'
import { forwardCause } from '../../domain/error-chain.js'

function validateCharacterPayload(
  body: NeopleCharacter,
  identity: CharacterIdentity
): CharacterPayload {
  if (body.characterId !== identity.characterId || body.serverId !== identity.serverId) {
    throw new CharacterDetailFailure('api')
  }

  return body
}

export function createNeopleCharacterDetails(
  neople: Pick<NeopleClient, 'character'>
): FetchCharacterDetails {
  return async (identity, requestSignal, recordStage) => {
    const failureController = new AbortController()
    const signal = AbortSignal.any([requestSignal, failureController.signal])
    const results = {} as CharacterPayloads
    const load = async (section: CharacterDetailSection): Promise<void> => {
      const body = await neople.character(identity, section, signal)
      results[section] = validateCharacterPayload(body, identity)
    }
    try {
      // ky hands an already aborted request to fetch, so a cancelled request stops before any transport.
      requestSignal.throwIfAborted()
      // Confirm identity before spending the other ten provider requests.
      const basicStartedAt = performance.now()
      await load('basic')
      recordStage('basic', elapsedMs(basicStartedAt))
      const sections = characterDetailSections.filter((section) => section !== 'basic')
      const sectionsStartedAt = performance.now()
      await Promise.all(sections.map(load))
      recordStage('sections', elapsedMs(sectionsStartedAt))

      return results
    } catch (error) {
      failureController.abort()
      if (error instanceof NeopleRequestFailure && error.kind === 'timeout') {
        throw new CharacterDetailFailure('timeout')
      }

      if (requestSignal.aborted) {
        throw new CharacterDetailFailure('internal')
      }

      if (error instanceof CharacterDetailFailure) {
        throw error
      }

      if (error instanceof NeopleRequestFailure) {
        const kind = error.characterNotFound ? 'notFound' : error.kind
        throw new CharacterDetailFailure(kind, forwardCause(error))
      }
      throw new CharacterDetailFailure('api', { cause: error })
    }
  }
}
