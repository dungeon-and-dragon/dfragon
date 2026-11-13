import { projectCharacterCard } from '../../domain/character-card/project.js'
import { cardScoreCalculator, withCardScore } from '../../domain/character-card/score.js'
import {
  projectCharacterDetails,
  projectCharacterFreshness
} from '../../domain/character-detail/project.js'
import type {
  CharacterIdentity,
  FetchedCharacterPayloads
} from '../../domain/character-detail/sections.js'
import { CharacterDetailFailure, characterDetailFailure } from '../../domain/character-failure.js'
import { type CalculatedScore, toCalculatedScore } from '../../domain/score/calculated.js'
import { toScoreEngineInput } from '../../domain/score/input.js'
import { enrichCharacterDetails, hasUnavailableItemDetail } from '../character-catalog/enrich.js'
import type { CatalogService } from '../character-catalog/service.js'
import { type LoadCharacter, createCharacterCache } from './character-cache.js'
import { type NeopleStageTimings, elapsedMs } from './neople-stages.js'
import type { CalculateScore, PublishCharacterFetched, FetchCharacterDetails } from './ports.js'

export interface CharacterDetailResponse {
  body: Buffer<ArrayBuffer>
  reused: boolean
}

export interface CharacterDetailDependencies {
  fetchDetails: FetchCharacterDetails
  catalog: CatalogService
  calculateScore: CalculateScore
  publishCharacterFetched?: PublishCharacterFetched
}

export function createCharacterDetailService(deps: CharacterDetailDependencies) {
  const adapter = deps.fetchDetails
  const shutdown = new AbortController()
  const active = new Set<Promise<unknown>>()

  const characters = createCharacterCache(async (identity, fetchSignal, recordStage) => {
    fetchSignal.throwIfAborted()
    const payloads = await adapter(identity, fetchSignal, recordStage)
    const fetchedAt = new Date()

    return { payloads, fetchedAt }
  })
  // Keyed by the cached character object, a body lives exactly as long as that cache entry: an expired,
  // evicted or refreshed entry takes its body with it.
  const bodies = new WeakMap<FetchedCharacterPayloads, Buffer<ArrayBuffer>>()
  const buildResponse = async (
    identity: CharacterIdentity,
    character: FetchedCharacterPayloads,
    signal: AbortSignal,
    timings: NeopleStageTimings
  ): Promise<{ response: CharacterDetailResponse; score: CalculatedScore | null }> => {
    signal.throwIfAborted()
    const reusable = bodies.get(character)

    if (reusable !== undefined) {
      return { response: { body: reusable, reused: true }, score: null }
    }

    const { payloads, fetchedAt } = character
    const projected = projectCharacterDetails(identity, payloads, fetchedAt)
    const freshness = projectCharacterFreshness(fetchedAt)
    const catalogStartedAt = performance.now()
    const { details, items } = await enrichCharacterDetails(projected, deps.catalog, signal)
    timings.record('catalog', elapsedMs(catalogStartedAt))
    signal.throwIfAborted()
    const unscored = projectCharacterCard(projected)
    const input = toScoreEngineInput(payloads, items)
    const result = await deps.calculateScore(input, cardScoreCalculator(unscored.role), signal)
    const score = toCalculatedScore(result, new Date())
    const card = withCardScore(unscored, result)
    // Plain JSON.stringify output with no replacer, spaces or HTML escaping, so the stored bytes match what a
    // JSON response sends.
    const body = Buffer.from(JSON.stringify({ ...details, freshness, card }))

    // An unavailable item stays out of the stored body so the next request looks it up again.
    if (!bodies.has(character) && !hasUnavailableItemDetail(details)) {
      bodies.set(character, body)
    }

    return { response: { body, reused: false }, score }
  }
  const respond = async (
    identity: CharacterIdentity,
    requestSignal: AbortSignal,
    timings: NeopleStageTimings,
    loadCharacter: LoadCharacter
  ): Promise<CharacterDetailResponse> => {
    const signal = AbortSignal.any([requestSignal, shutdown.signal])
    try {
      if (signal.aborted) {
        throw new CharacterDetailFailure('internal')
      }

      const character = await loadCharacter(identity, signal, timings)
      const built = buildResponse(identity, character, signal, timings)
      const score = built.then(
        (value) => value.score,
        () => null
      )

      // 받은 뒤에 내서, 존재하지 않는 캐릭터 ID로 구독자가 기록을 만들지 않게 한다.
      deps.publishCharacterFetched?.(identity, character.payloads, character.fetchedAt, score)

      return (await built).response
    } catch (error) {
      throw characterDetailFailure(error)
    }
  }
  const track = <T>(operation: Promise<T>): Promise<T> => {
    active.add(operation)
    operation.finally(() => active.delete(operation)).catch(() => undefined)

    return operation
  }

  return {
    get(identity: CharacterIdentity, signal: AbortSignal, timings: NeopleStageTimings) {
      return track(respond(identity, signal, timings, characters.get))
    },
    refresh(identity: CharacterIdentity, signal: AbortSignal, timings: NeopleStageTimings) {
      return track(respond(identity, signal, timings, characters.refresh))
    },
    async close() {
      shutdown.abort()
      await Promise.allSettled([...active, characters.close(), deps.catalog.close()])
    }
  }
}

export type CharacterDetailService = ReturnType<typeof createCharacterDetailService>
