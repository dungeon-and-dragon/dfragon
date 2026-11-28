import {
  projectCharacterCard,
  cardScoreCalculator,
  withCardScore
} from '@dfragon/server-core/domain/character-card/index.js'
import type { CatalogDetail } from '@dfragon/server-core/domain/character-catalog/index.js'
import {
  projectCharacterDetails,
  projectCharacterFreshness,
  type CharacterIdentity,
  type CharacterPayload,
  type CharacterPayloads,
  type FetchedCharacterPayloads
} from '@dfragon/server-core/domain/character-detail/index.js'
import type { CharacterRole } from '@dfragon/server-core/domain/character-role.js'
import {
  CharacterDetailFailure,
  characterDetailFailure
} from '@dfragon/server-core/domain/character-failure.js'
import {
  type CalculatedScore,
  toCalculatedScore,
  toScoreEngineInput
} from '@dfragon/server-core/domain/score/index.js'
import {
  enrichCharacterDetails,
  hasUnavailableItemDetail
} from '@dfragon/server-core/application/character-catalog/index.js'
import type { CharacterCatalog } from '@dfragon/server-core/application/character-catalog/ports.js'
import { type LoadCharacter, createCharacterCache } from './character-cache.js'
import {
  type NeopleStageTimings,
  elapsedMs
} from '@dfragon/server-core/application/character-detail/index.js'
import type {
  CalculateScore,
  PublishCharacterFetched,
  FetchCharacterDetails
} from '@dfragon/server-core/application/character-detail/ports.js'

export interface CharacterDetailResponse {
  body: Buffer<ArrayBuffer>
  reused: boolean
}

export interface CharacterScoreSource {
  /** 캐시 항목이 가진 원문 객체 그대로라 같은 항목이면 같은 객체다. 항목에 묶은 값의 key로 쓰고 바꾸지 않는다. */
  payloads: CharacterPayloads
  role: CharacterRole | null
  items: ReadonlyMap<string, CatalogDetail>
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

  /** 상세 조회와 같은 캐시의 원문으로 점수 입력 재료만 돌려주며, 상세 본문을 저장하거나 조회를 알리지 않는다. */
  scoreSource(
    identity: CharacterIdentity,
    signal: AbortSignal,
    timings: NeopleStageTimings
  ): Promise<CharacterScoreSource> {
    return this.track(this.loadScoreSource(identity, signal, timings))
  }

  /** 상세 조회와 같은 캐시의 장비 섹션 원문만 돌려주며, 상세 본문을 저장하거나 조회를 알리지 않는다. */
  equipment(
    identity: CharacterIdentity,
    signal: AbortSignal,
    timings: NeopleStageTimings
  ): Promise<CharacterPayload> {
    return this.track(this.loadEquipment(identity, signal, timings))
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

  private async loadEquipment(
    identity: CharacterIdentity,
    requestSignal: AbortSignal,
    timings: NeopleStageTimings
  ): Promise<CharacterPayload> {
    const signal = AbortSignal.any([requestSignal, this.shutdown.signal])

    try {
      if (signal.aborted) {
        throw new CharacterDetailFailure('internal')
      }

      const { payloads } = await this.characters.get(identity, signal, timings)

      return payloads.equipment
    } catch (error) {
      throw characterDetailFailure(error)
    }
  }

  private async loadScoreSource(
    identity: CharacterIdentity,
    requestSignal: AbortSignal,
    timings: NeopleStageTimings
  ): Promise<CharacterScoreSource> {
    const signal = AbortSignal.any([requestSignal, this.shutdown.signal])

    try {
      if (signal.aborted) {
        throw new CharacterDetailFailure('internal')
      }

      const { payloads, fetchedAt } = await this.characters.get(identity, signal, timings)
      const projected = projectCharacterDetails(identity, payloads, fetchedAt)
      const { items } = await enrichCharacterDetails(projected, this.ports.catalog, signal)
      signal.throwIfAborted()
      const { role } = projectCharacterCard(projected)

      return { payloads, role, items }
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
