import { readSecretInput } from '@dfragon/database'
import { createNeopleClient } from '@dfragon/neople'
import { createNeopleCharacterSearch } from '../dist/characters/neople-character-search.js'
import { createNeopleCharacterDetails } from '../dist/characters/details/neople.js'
import { isCatalogId } from '../dist/characters/catalog/types.js'
import {
  SkillVerificationFailure,
  loadSkillPackage,
  parseVerificationArguments,
  verificationError,
  verifyCharacterSkills
} from './skill-calculation.mjs'

function createSkillLookup(neople) {
  return async ([key], signal) => {
    if (!key || !isCatalogId(key.jobId) || !isCatalogId(key.skillId)) {
      throw new Error('Invalid skill request')
    }
    let body
    try {
      body = await neople.skill(key.jobId, key.skillId, signal)
    } catch {
      throw new Error('Skill lookup failed')
    }
    if (body.jobId !== key.jobId || (body.skillId !== undefined && body.skillId !== key.skillId)) {
      throw new Error('Invalid skill identity')
    }

    return [{ key, payload: body }]
  }
}

try {
  const options = parseVerificationArguments(process.argv.slice(2))
  const skillPackage = await loadSkillPackage(options.packageDirectory)
  let apiKey
  try {
    apiKey = readSecretInput(process.env.NEOPLE_API_KEY, process.env.NEOPLE_API_KEY_FILE)
    if (!apiKey) {
      throw new Error()
    }
  } catch {
    throw new SkillVerificationFailure('INVALID_SECRET')
  }
  const neople = createNeopleClient(apiKey)
  const providers = {
    searchCharacters: createNeopleCharacterSearch(neople),
    fetchDetails: createNeopleCharacterDetails(neople),
    fetchCatalog: createSkillLookup(neople)
  }
  const summary = await verifyCharacterSkills(options, skillPackage, providers)
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
} catch (error) {
  process.stderr.write(`${JSON.stringify(verificationError(error))}\n`)
  process.exitCode = 1
}
