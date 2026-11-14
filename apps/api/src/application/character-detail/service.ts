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
import type { CharacterCatalog } from '../character-catalog/ports.js'
import { type LoadCharacter, createCharacterCache } from './character-cache.js'
import { type NeopleStageTimings, elapsedMs } from './neople-stages.js'
import type { CalculateScore, PublishCharacterFetched, FetchCharacterDetails } from './ports.js'

export interface CharacterDetailResponse {
  body: Buffer<ArrayBuffer>
  reused: boolean
}

export interface CharacterDetailDependencies {
  fetchDetails: FetchCharacterDetails
  catalog: CharacterCatalog
  calculateScore: CalculateScore
  publishCharacterFetched?: PublishCharacterFetched
}

type CharacterCache = ReturnType<typeof createCharacterCache>

export class CharacterDetailService {
  private readonly shutdown = new AbortController()
  private readonly active = new Set<Promise<unknown>>()
  private readonly characters: CharacterCache
  // Keyed by the cached character object, a body lives exactly as long as that cache entry: an expired,
  // evicted or refreshed entry takes its body with it.
  private readonly bodies = new WeakMap<FetchedCharacterPayloads, Buffer<ArrayBuffer>>()

  constructor(private readonly ports: CharacterDetailDependencies) {
    this.characters = createCharacterCache(async (identity, fetchSignal, recordStage) => {
      fetchSignal.throwIfAborted()
      const payloads = await this.ports.fetchDetails(identity, fetchSignal, recordStage)
      const fetchedAt = new Date()

      return { payloads, fetchedAt }
    })
  }

  get(
    identity: CharacterIdentity,
    signal: AbortSignal,
    timings: NeopleStageTimings
  ): Promise<CharacterDetailResponse> {
    return this.track(this.respond(identity, signal, timings, this.characters.get))
  }

  refresh(
    identity: CharacterIdentity,
    signal: AbortSignal,
    timings: NeopleStageTimings
  ): Promise<CharacterDetailResponse> {
    return this.track(this.respond(identity, signal, timings, this.characters.refresh))
  }

  async close(): Promise<void> {
    this.shutdown.abort()
    await Promise.allSettled([...this.active, this.characters.close(), this.ports.catalog.close()])
  }

  private async buildResponse(
    identity: CharacterIdentity,
    character: FetchedCharacterPayloads,
    signal: AbortSignal,
    timings: NeopleStageTimings
  ): Promise<{ response: CharacterDetailResponse; score: CalculatedScore | null }> {
    signal.throwIfAborted()
    const reusable = this.bodies.get(character)

    if (reusable !== undefined) {
      return { response: { body: reusable, reused: true }, score: null }
    }

    const { payloads, fetchedAt } = character
    const projected = projectCharacterDetails(identity, payloads, fetchedAt)
    const freshness = projectCharacterFreshness(fetchedAt)
    const catalogStartedAt = performance.now()
    const { details, items } = await enrichCharacterDetails(projected, this.ports.catalog, signal)
    timings.record('catalog', elapsedMs(catalogStartedAt))
    signal.throwIfAborted()
    const unscored = projectCharacterCard(projected)
    const input = toScoreEngineInput(payloads, items)
    const result = await this.ports.calculateScore(
      input,
      cardScoreCalculator(unscored.role),
      signal
    )
    const score = toCalculatedScore(result, new Date())
    const card = withCardScore(unscored, result)
    // Plain JSON.stringify output with no replacer, spaces or HTML escaping, so the stored bytes match what a
    // JSON response sends.
    const body = Buffer.from(JSON.stringify({ ...details, freshness, card }))

    // An unavailable item stays out of the stored body so the next request looks it up again.
    if (!this.bodies.has(character) && !hasUnavailableItemDetail(details)) {
      this.bodies.set(character, body)
    }

    return { response: { body, reused: false }, score }
  }

  private async respond(
    identity: CharacterIdentity,
    requestSignal: AbortSignal,
    timings: NeopleStageTimings,
    loadCharacter: LoadCharacter
  ): Promise<CharacterDetailResponse> {
    const signal = AbortSignal.any([requestSignal, this.shutdown.signal])

    try {
      if (signal.aborted) {
        throw new CharacterDetailFailure('internal')
      }

      const character = await loadCharacter(identity, signal, timings)
      const built = this.buildResponse(identity, character, signal, timings)
      const score = built.then(
        (value) => value.score,
        () => null
      )

      // 받은 뒤에 내서, 존재하지 않는 캐릭터 ID로 구독자가 기록을 만들지 않게 한다.
      this.ports.publishCharacterFetched?.(identity, character.payloads, character.fetchedAt, score)

      return (await built).response
    } catch (error) {
      throw characterDetailFailure(error)
    }
  }

  private track<T>(operation: Promise<T>): Promise<T> {
    this.active.add(operation)
    operation.finally(() => this.active.delete(operation)).catch(() => undefined)

    return operation
  }
}
