import { CharacterDetailFailure, characterDetailFailure } from './errors.js'
import type { FetchCharacterDetails } from './neople.js'
import { projectCharacterDetails, projectCharacterFreshness } from './project.js'
import type { CharacterIdentity, FetchedCharacterPayloads } from './sections.js'
import { enrichCharacterDetails, hasUnavailableItemDetail } from '../catalog/enrich.js'
import { type LoadCharacter, createCharacterCache } from './character-cache.js'
import { type NeopleStageTimings, elapsedMs } from './neople-stages.js'
import type { CatalogService } from '../catalog/service.js'
import { projectCharacterCard } from '../card/project.js'
import { cardScoreCalculator, withCardScore } from '../card/score.js'
import type { ScoreEngine } from '../../score/engine.js'
import { toScoreEngineInput } from '../../score/input.js'
import type { RequestTimelineSync } from '../timeline/queue.js'

export interface CharacterDetailResponse {
  body: Buffer
  reused: boolean
}

export interface CharacterDetailDependencies {
  fetchDetails: FetchCharacterDetails
  catalog: CatalogService
  calculateScore: ScoreEngine['calculate']
  requestTimelineSync?: RequestTimelineSync
}

export { parseCharacterIdentity } from '../identity.js'

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
  const bodies = new WeakMap<FetchedCharacterPayloads, Buffer>()
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
      // 기본정보로 있는 캐릭터임을 확인한 뒤에 넣어, 없는 캐릭터 ID로 동기화 상태 행이 생기지 않게 한다.
      deps.requestTimelineSync?.(identity)
      signal.throwIfAborted()
      const reusable = bodies.get(character)
      if (reusable !== undefined) {
        return { body: reusable, reused: true }
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
      const card = withCardScore(unscored, result)
      // Express `json` serializes with plain JSON.stringify unless the app sets a replacer, spaces or escape, and
      // this app sets none, so the stored bytes match what `json` sent before.
      const body = Buffer.from(JSON.stringify({ ...details, freshness, card }))
      // An unavailable item stays out of the stored body so the next request looks it up again.
      if (!bodies.has(character) && !hasUnavailableItemDetail(details)) {
        bodies.set(character, body)
      }

      return { body, reused: false }
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
    async onModuleDestroy() {
      shutdown.abort()
      await Promise.allSettled([...active, characters.close(), deps.catalog.close()])
    }
  }
}

export type CharacterDetailService = ReturnType<typeof createCharacterDetailService>
