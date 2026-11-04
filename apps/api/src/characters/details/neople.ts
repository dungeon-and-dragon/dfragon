import { type NeopleCharacter, type NeopleClient, NeopleRequestFailure } from '@dfragon/neople'
import { forwardCause } from '../../error-chain.js'
import { CharacterDetailFailure } from './errors.js'
import { type RecordNeopleStage, elapsedMs } from './neople-stages.js'
import { characterDetailSections } from './sections.js'
import type {
  CharacterDetailSection,
  CharacterIdentity,
  CharacterPayload,
  CharacterPayloads
} from './sections.js'

function validateCharacterPayload(
  body: NeopleCharacter,
  identity: CharacterIdentity
): CharacterPayload {
  if (body.characterId !== identity.characterId || body.serverId !== identity.serverId) {
    throw new CharacterDetailFailure('api')
  }

  return body
}

export type FetchCharacterDetails = (
  identity: CharacterIdentity,
  signal: AbortSignal,
  recordStage: RecordNeopleStage
) => Promise<CharacterPayloads>

export function createNeopleCharacterDetails(neople: NeopleClient): FetchCharacterDetails {
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
        throw new CharacterDetailFailure(error.kind, forwardCause(error))
      }
      throw new CharacterDetailFailure('api', { cause: error })
    }
  }
}
