import { assert } from '@dfragon/lib/utils/assert'
import { textOrNull } from '@dfragon/lib/utils/shape-check'
import {
  type NeopleCharacterSearchRow,
  type NeopleClient,
  NeopleRequestFailure
} from '@dfragon/neople'
import { NEOPLE_SERVER_NAMES } from '../constants/neople-character-search.js'
import { forwardCause } from '../error-chain.js'
import { NeopleSearchFailure } from '../errors/neople-search.js'
import { CHARACTER_ID_PATTERN } from './identity.js'
import type {
  CharacterSearchRow,
  NeopleCharacterSearchResult,
  NeopleCharacterSearchInput,
  SearchCharacters
} from '../types/neople-character-search.js'

const invalidResponse = (): NeopleSearchFailure => new NeopleSearchFailure('api')

function projectRow(
  candidate: NeopleCharacterSearchRow,
  input: NeopleCharacterSearchInput
): CharacterSearchRow {
  const { characterId, characterName, serverId, fame } = candidate

  // Neople match ignores letter case, so a name differing only in case is a valid response row.
  if (input.wordType === 'match') {
    assert(characterName.toLowerCase() === input.characterName.toLowerCase(), invalidResponse)
    assert(NEOPLE_SERVER_NAMES.has(serverId), invalidResponse)
    assert(CHARACTER_ID_PATTERN.test(characterId), invalidResponse)
  }

  const serverName = NEOPLE_SERVER_NAMES.get(serverId) ?? null
  const knownFame = fame ?? null
  const jobName = textOrNull(candidate.jobName)
  const jobGrowName = textOrNull(candidate.jobGrowName)

  return {
    characterId,
    characterName,
    serverId,
    serverName,
    fame: knownFame,
    jobName,
    jobGrowName
  }
}

function projectResponse(
  candidates: NeopleCharacterSearchRow[],
  input: NeopleCharacterSearchInput
): NeopleCharacterSearchResult {
  const rows = candidates.map((candidate) => projectRow(candidate, input))
  if (input.wordType === 'match') {
    const exactRows = rows.filter((row) => row.characterName === input.characterName)

    return { rows: exactRows }
  }

  return { rows }
}

export function createNeopleCharacterSearch(neople: NeopleClient): SearchCharacters {
  return async (input) => {
    try {
      const { rows } = await neople.searchCharacters(input.serverId, {
        characterName: input.characterName,
        limit: input.limit,
        wordType: input.wordType ?? 'full'
      })

      return projectResponse(rows, input)
    } catch (error) {
      if (error instanceof NeopleRequestFailure) {
        throw new NeopleSearchFailure(error.kind, forwardCause(error))
      }

      if (error instanceof NeopleSearchFailure) {
        throw error
      }
      throw new NeopleSearchFailure('api', { cause: error })
    }
  }
}
