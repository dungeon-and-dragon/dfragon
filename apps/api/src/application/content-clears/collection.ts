import type {
  ClearPopulationCharacter,
  ContentClearCollectionProgress,
  ContentClearInput
} from '@dfragon/database'
import type { FetchCharacterTimeline } from '../character-timeline/ports.js'
import { TimelineFailure } from '../../domain/character-timeline/failure.js'
import {
  CLEAR_CONTENTS,
  toCollectionMinFame,
  toContentClearInput
} from '../../domain/content-clears/contents.js'
import {
  type ClearCollectionPlan,
  planClearCollection,
  toContentPopulation,
  weekKey
} from '../../domain/content-clears/collection.js'
import { createUnavailableStreaks } from '../jobs/unavailable-streaks.js'
import type { ClearCollectionStore, ClearCollectionDependencies } from './ports.js'

export const UNAVAILABLE_PAUSE_MS = 60_000

export type ClearCollectionSummary = {
  startedAt: string
  characters: number
  requests: number
  clears: number
  skipped: number
}

type CharacterClears =
  | { status: 'collected'; clears: ContentClearInput[] }
  | { status: 'skipped' }
  | { status: 'unavailable'; reason: string }

function toUnavailableReason({ kind, upstream, keyShortage }: TimelineFailure): string {
  if (keyShortage !== undefined) {
    return keyShortage
  }

  if (upstream === undefined) {
    return kind
  }

  const code = upstream.code ?? 'none'

  return `${upstream.status}/${code}`
}

function countReasons(results: readonly CharacterClears[]): string {
  const counts = new Map<string, number>()
  for (const result of results) {
    if (result.status === 'unavailable') {
      counts.set(result.reason, (counts.get(result.reason) ?? 0) + 1)
    }
  }

  return [...counts]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([reason, count]) => `${reason}=${count}`)
    .join(',')
}

async function collectCharacterClears(
  character: ClearPopulationCharacter,
  plan: ClearCollectionPlan,
  plannedWeeks: ReadonlySet<string>,
  fetchTimeline: FetchCharacterTimeline
): Promise<CharacterClears> {
  const clears: ContentClearInput[] = []
  try {
    for (const range of plan.ranges) {
      const { events, items } = await fetchTimeline(character, range)
      for (const row of [...events, ...items]) {
        const clear = toContentClearInput(character, row)
        if (clear !== undefined && plannedWeeks.has(weekKey(clear.contentId, clear.weekStart))) {
          clears.push(clear)
        }
      }
    }
  } catch (error) {
    if (!(error instanceof TimelineFailure)) {
      throw error
    }

    // 한도 초과, 점검, timeout은 대개 캐릭터 문제가 아니라 쉬었다가 같은 캐릭터를 다시 부른다.
    if (error.kind === 'unavailable' || error.kind === 'timeout') {
      return { status: 'unavailable', reason: toUnavailableReason(error) }
    }

    return { status: 'skipped' }
  }

  return { status: 'collected', clears }
}

async function readOrStartProgress(
  store: ClearCollectionStore,
  now: () => Date
): Promise<ContentClearCollectionProgress> {
  const progress = await store.readProgress()
  if (progress !== undefined) {
    return progress
  }
  const startedAt = now()
  await store.startProgress(startedAt)

  return { startedAt, done: 0 }
}

/**
 * 진행 위치를 캐릭터 묶음마다 저장해, 도중에 끝난 수집은 다음 실행이 같은 시작 시각의 구간으로 남은 캐릭터부터 이어 받는다.
 * 모집단은 클리어 기록을 다 저장한 뒤 저장한다. 조회는 모집단의 수집 시각이 바뀔 때 집계를 다시 읽는다.
 */
export async function collectContentClears({
  store,
  createFetchTimeline,
  readConcurrency,
  now,
  pause,
  report,
  reportProgress
}: ClearCollectionDependencies): Promise<ClearCollectionSummary> {
  const { startedAt, done: resumedAt } = await readOrStartProgress(store, now)
  const plan = planClearCollection(CLEAR_CONTENTS, await store.readPopulations(), startedAt)
  const plannedWeeks = new Set(
    plan.weeks.map(({ contentId, weekStart }) => weekKey(contentId, weekStart))
  )
  const collectionMinFame = toCollectionMinFame(CLEAR_CONTENTS)
  const population = await store.readPopulation(collectionMinFame)
  const counts = { requests: 0, clears: 0, skipped: 0 }
  const fetchTimeline = createFetchTimeline(() => {
    counts.requests++
  })
  report('CONTENT_CLEAR_COLLECTION_STARTED', {
    startedAt: startedAt.toISOString(),
    done: resumedAt,
    minFame: collectionMinFame,
    characters: population.length,
    ranges: plan.ranges.length
  })

  const unavailableStreaks = createUnavailableStreaks<ClearPopulationCharacter>()
  let done = resumedAt
  while (done < population.length) {
    const group = population.slice(done, done + readConcurrency())
    const results = await Promise.all(
      group.map((character) => collectCharacterClears(character, plan, plannedWeeks, fetchTimeline))
    )
    const unavailable = group.filter((_, index) => results[index]?.status === 'unavailable')
    if (unavailable.length > 0) {
      if (unavailableStreaks.decide(group.length, unavailable) === 'retry') {
        report('CONTENT_CLEAR_NEOPLE_UNAVAILABLE', {
          done,
          characters: group.length,
          unavailable: unavailable.length,
          reasons: countReasons(results)
        })
        await pause(UNAVAILABLE_PAUSE_MS)
        continue
      }
      for (const character of unavailable) {
        report('CONTENT_CLEAR_CHARACTER_SKIPPED', { position: done + group.indexOf(character) })
      }
    }
    const clears = results.flatMap((result) => (result.status === 'collected' ? result.clears : []))
    if (clears.length > 0) {
      await store.recordClears(clears)
    }
    counts.clears += clears.length
    counts.skipped += results.filter(({ status }) => status !== 'collected').length
    done += group.length
    await store.recordProgress({ startedAt, done })
    reportProgress(done, population.length)
  }

  const collectedAt = now()
  for (const content of CLEAR_CONTENTS) {
    const contentPopulation = toContentPopulation(content, population, collectionMinFame)
    for (const week of plan.weeks.filter(({ contentId }) => contentId === content.id)) {
      await store.recordPopulation({ ...week, ...contentPopulation, collectedAt })
    }
  }
  await store.finishProgress(startedAt)
  const summary = { startedAt: startedAt.toISOString(), characters: population.length, ...counts }
  report('CONTENT_CLEAR_COLLECTION_DONE', summary)

  return summary
}
