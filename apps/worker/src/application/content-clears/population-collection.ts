import type { ClearPopulationCharacter, TimelineRange } from '@dfragon/database'
import type { FetchCharacterTimeline } from '@dfragon/server-core/application/character-timeline/ports.js'
import {
  TimelineFailure,
  type TimelineRow
} from '@dfragon/server-core/domain/character-timeline/index.js'
import { fetchGroupWithRetry } from '#application/jobs/index.js'

export { UNAVAILABLE_PAUSE_MS } from '#application/jobs/index.js'

export type CollectionProgress = {
  startedAt: Date
  done: number
}

export type CollectionProgressRepository = {
  readProgress(): Promise<CollectionProgress | undefined>
  startProgress(startedAt: Date): Promise<void>
}

export type CollectedCharacter = {
  character: ClearPopulationCharacter
  rows: TimelineRow[]
}

type CharacterRows =
  | { status: 'collected'; rows: TimelineRow[] }
  | { status: 'skipped' }
  | { status: 'unavailable'; reason: string }

export type PopulationCollection = {
  population: readonly ClearPopulationCharacter[]
  resumedAt: number
  rangesOf: (character: ClearPopulationCharacter) => readonly TimelineRange[]
  fetchTimeline: FetchCharacterTimeline
  readConcurrency: () => number
  pause: (ms: number) => Promise<void>
  report: (code: string, details: Readonly<Record<string, string | number>>) => void
  reportProgress: (done: number, total: number) => void
  events: { unavailable: string; skipped: string }
  recordGroup: (collected: readonly CollectedCharacter[]) => Promise<void>
  recordProgress: (done: number) => Promise<void>
}

export async function readOrStartProgress(
  repository: CollectionProgressRepository,
  now: () => Date
): Promise<CollectionProgress> {
  const progress = await repository.readProgress()
  if (progress !== undefined) {
    return progress
  }

  const startedAt = now()
  await repository.startProgress(startedAt)

  return { startedAt, done: 0 }
}

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

function countReasons(results: readonly CharacterRows[]): string {
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

async function fetchCharacterRows(
  character: ClearPopulationCharacter,
  ranges: readonly TimelineRange[],
  fetchTimeline: FetchCharacterTimeline
): Promise<CharacterRows> {
  const rows: TimelineRow[] = []

  try {
    for (const range of ranges) {
      const { events, items } = await fetchTimeline(character, range)
      rows.push(...events, ...items)
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

  return { status: 'collected', rows }
}

export async function collectPopulation({
  population,
  resumedAt,
  rangesOf,
  fetchTimeline,
  readConcurrency,
  pause,
  report,
  reportProgress,
  events,
  recordGroup,
  recordProgress
}: PopulationCollection): Promise<number> {
  let skipped = 0
  let done = resumedAt

  while (done < population.length) {
    const group = population.slice(done, done + readConcurrency())
    const results = await fetchGroupWithRetry(
      group,
      (characters) =>
        Promise.all(
          characters.map((character) =>
            fetchCharacterRows(character, rangesOf(character), fetchTimeline)
          )
        ),
      {
        isUnavailable: (result) => result.status === 'unavailable',
        pause,
        onUnavailable: ({ attempted, unavailable, paused }) => {
          const reasons = countReasons(unavailable)
          report(events.unavailable, {
            done,
            characters: attempted,
            unavailable: unavailable.length,
            paused: paused ? 1 : 0,
            reasons
          })
        }
      }
    )

    for (const [index, result] of results.entries()) {
      if (result.status === 'unavailable') {
        report(events.skipped, { position: done + index })
      }
    }

    const collected = group.flatMap((character, index) => {
      const result = results[index]

      if (result?.status !== 'collected') {
        return []
      }

      return [{ character, rows: result.rows }]
    })

    await recordGroup(collected)
    skipped += group.length - collected.length
    done += group.length
    await recordProgress(done)
    reportProgress(done, population.length)
  }

  return skipped
}
