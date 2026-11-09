import type {
  ClearPopulationCharacter,
  ClearPopulationJob,
  ContentClearCollectionProgress,
  ContentClearInput,
  ContentClearPopulationInput,
  StoredClearPopulation,
  TimelineRange
} from '@dfragon/database'
import type { NeopleClient } from '@dfragon/neople'
import { addWeeks, subMinutes } from 'date-fns'
import { TimelineFailure } from '../characters/timeline/errors.js'
import {
  type FetchCharacterTimeline,
  createNeopleCharacterTimeline
} from '../characters/timeline/neople.js'
import { splitTimelineRanges } from '../characters/timeline/ranges.js'
import { startOfResetWeek } from '../utils/seoul-time.js'
import {
  CLEAR_CONTENTS,
  type ClearContent,
  toContentClearInput,
  toLatestContents
} from './contents.js'

export const UNAVAILABLE_PAUSE_MS = 60_000

const CLEAR_TIMELINE_CODES = [
  ...new Set(
    CLEAR_CONTENTS.flatMap(({ rule }) => (rule.type === 'clear' ? rule.codes : [rule.code]))
  )
].sort((left, right) => left - right)

type ClearCollectionWeek = {
  contentId: string
  weekStart: Date
  closed: boolean
}

type ClearCollectionPlan = {
  ranges: TimelineRange[]
  weeks: ClearCollectionWeek[]
}

export type ClearCollectionStore = {
  readPopulation(): Promise<ClearPopulationCharacter[]>
  readPopulations(): Promise<StoredClearPopulation[]>
  readProgress(): Promise<ContentClearCollectionProgress | undefined>
  startProgress(startedAt: Date): Promise<void>
  recordProgress(progress: ContentClearCollectionProgress): Promise<void>
  recordClears(clears: readonly ContentClearInput[]): Promise<void>
  recordPopulation(population: ContentClearPopulationInput): Promise<void>
  finishProgress(startedAt: Date): Promise<void>
}

export type ClearCollectionDependencies = {
  store: ClearCollectionStore
  neople: Pick<NeopleClient, 'characterTimeline'>
  concurrency: number
  now: () => Date
  pause: (ms: number) => Promise<void>
  report: (code: string, details: Readonly<Record<string, string | number>>) => void
  reportProgress: (done: number, total: number) => void
}

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
  | { status: 'unavailable' }

function eachWeek(start: Date, last: Date): Date[] {
  const weeks: Date[] = []
  for (let week = start; week <= last; week = addWeeks(week, 1)) {
    weeks.push(week)
  }

  return weeks
}

function openWeekTimes(stored: readonly StoredClearPopulation[]): number[] {
  return stored.filter(({ closed }) => !closed).map(({ weekStart }) => weekStart.getTime())
}

// 레이드는 지금 주부터 받고 첫 주는 따로 채운다. 챌린지는 출시부터 누적으로 세므로 처음 한 번은 출시 주부터 받는다.
function firstDailyWeek(
  content: ClearContent,
  stored: readonly StoredClearPopulation[],
  currentWeek: Date
): Date {
  const openWeeks = openWeekTimes(stored)
  if (openWeeks.length > 0) {
    return new Date(Math.min(...openWeeks))
  }

  if (content.kind === 'challenge') {
    return startOfResetWeek(content.releasedAt)
  }

  return currentWeek
}

// 새 컨텐츠에 밀려난 컨텐츠는 마감하지 않은 주만 끝까지 마저 받아 마감하고, 그 뒤로는 받지 않는다.
function unclosedWeeks(stored: readonly StoredClearPopulation[]): Date[] {
  const openWeeks = openWeekTimes(stored)
  if (openWeeks.length === 0) {
    return []
  }

  return eachWeek(new Date(Math.min(...openWeeks)), new Date(Math.max(...openWeeks)))
}

function needsFirstWeek(
  content: ClearContent,
  stored: readonly StoredClearPopulation[],
  dailyWeeks: readonly Date[]
): boolean {
  const firstWeek = startOfResetWeek(content.releasedAt).getTime()
  const filled = stored.some(({ weekStart, closed }) => closed && weekStart.getTime() === firstWeek)
  const daily = dailyWeeks.some((week) => week.getTime() === firstWeek)

  return !filled && !daily
}

function contentWeeks(
  content: ClearContent,
  latestIds: ReadonlySet<string>,
  populations: readonly StoredClearPopulation[],
  currentWeek: Date
): Date[] {
  const stored = populations.filter(({ contentId }) => contentId === content.id)
  const dailyWeeks = latestIds.has(content.id)
    ? eachWeek(firstDailyWeek(content, stored, currentWeek), currentWeek)
    : unclosedWeeks(stored)
  if (!needsFirstWeek(content, stored, dailyWeeks)) {
    return dailyWeeks
  }

  return [startOfResetWeek(content.releasedAt), ...dailyWeeks]
}

// 이어지는 주는 한 구간으로 묶어 캐릭터당 요청을 줄인다. 구간이 90일을 넘으면 Neople 한도에 맞춰 나눈다.
function toRanges(weeks: readonly ClearCollectionWeek[], startedAt: Date): TimelineRange[] {
  const starts = [...new Set(weeks.map(({ weekStart }) => weekStart.getTime()))].sort(
    (left, right) => left - right
  )
  const runs: { start: Date; end: Date }[] = []
  for (const start of starts) {
    const run = runs.at(-1)
    const end = addWeeks(start, 1)
    if (run?.end.getTime() === start) {
      run.end = end
    } else {
      runs.push({ start: new Date(start), end })
    }
  }

  return runs.flatMap(({ start, end }) =>
    splitTimelineRanges(start, end < startedAt ? subMinutes(end, 1) : startedAt)
  )
}

/** 종류별 최신 컨텐츠의 마감하지 않은 주와, 아직 채우지 않은 출시 첫 주를 받는다. */
function planClearCollection(
  contents: readonly ClearContent[],
  populations: readonly StoredClearPopulation[],
  startedAt: Date
): ClearCollectionPlan {
  const currentWeek = startOfResetWeek(startedAt)
  const released = contents.filter(({ releasedAt }) => releasedAt <= startedAt)
  const latestIds = new Set(toLatestContents(released).map(({ id }) => id))
  const weeks = released.flatMap((content) =>
    contentWeeks(content, latestIds, populations, currentWeek).map((weekStart) => ({
      contentId: content.id,
      weekStart,
      closed: weekStart < currentWeek
    }))
  )

  return { ranges: toRanges(weeks, startedAt), weeks }
}

const weekKey = (contentId: string, weekStart: Date) =>
  JSON.stringify([contentId, weekStart.getTime()])

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

    // 한도 초과, 점검, timeout은 캐릭터 문제가 아니라 쉬었다가 같은 캐릭터를 다시 부른다.
    if (error.kind === 'unavailable' || error.kind === 'timeout') {
      return { status: 'unavailable' }
    }

    return { status: 'skipped' }
  }

  return { status: 'collected', clears }
}

function toPopulationJobs(population: readonly ClearPopulationCharacter[]): ClearPopulationJob[] {
  const jobs = new Map<string, ClearPopulationJob>()
  for (const { jobId, jobGrowId, jobName, jobGrowName } of population) {
    const key = JSON.stringify([jobId, jobGrowId])
    const job = jobs.get(key) ?? { jobId, jobGrowId, jobName, jobGrowName, count: 0 }
    jobs.set(key, { ...job, count: job.count + 1 })
  }

  return [...jobs.values()]
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
  neople,
  concurrency,
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
  const population = await store.readPopulation()
  const counts = { requests: 0, clears: 0, skipped: 0 }
  const fetchTimeline = createNeopleCharacterTimeline(
    {
      characterTimeline: (identity, query) => {
        counts.requests++

        return neople.characterTimeline(identity, query)
      }
    },
    CLEAR_TIMELINE_CODES
  )
  report('CONTENT_CLEAR_COLLECTION_STARTED', {
    startedAt: startedAt.toISOString(),
    done: resumedAt,
    characters: population.length,
    ranges: plan.ranges.length
  })

  let done = resumedAt
  while (done < population.length) {
    const group = population.slice(done, done + concurrency)
    const results = await Promise.all(
      group.map((character) => collectCharacterClears(character, plan, plannedWeeks, fetchTimeline))
    )
    if (results.some(({ status }) => status === 'unavailable')) {
      report('CONTENT_CLEAR_NEOPLE_UNAVAILABLE', { done })
      await pause(UNAVAILABLE_PAUSE_MS)
      continue
    }
    const clears = results.flatMap((result) => (result.status === 'collected' ? result.clears : []))
    if (clears.length > 0) {
      await store.recordClears(clears)
    }
    counts.clears += clears.length
    counts.skipped += results.filter(({ status }) => status === 'skipped').length
    done += group.length
    await store.recordProgress({ startedAt, done })
    reportProgress(done, population.length)
  }

  const collectedAt = now()
  const jobs = toPopulationJobs(population)
  const minFame = population.at(-1)?.fame ?? null
  for (const week of plan.weeks) {
    await store.recordPopulation({
      ...week,
      population: population.length,
      minFame,
      jobs,
      collectedAt
    })
  }
  await store.finishProgress(startedAt)
  const summary = { startedAt: startedAt.toISOString(), characters: population.length, ...counts }
  report('CONTENT_CLEAR_COLLECTION_DONE', summary)

  return summary
}
