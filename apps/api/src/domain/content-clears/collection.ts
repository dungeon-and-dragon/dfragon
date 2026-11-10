import type {
  ClearPopulationCharacter,
  ClearPopulationJob,
  ContentClearPopulationInput,
  StoredClearPopulation,
  TimelineRange
} from '@dfragon/database'
import { addWeeks, subMinutes } from 'date-fns'
import { splitTimelineRanges } from '../character-timeline/ranges.js'
import { startOfResetWeek } from '../seoul-time.js'
import { type ClearContent, toPopulationMinFame } from './contents.js'

type ClearCollectionWeek = {
  contentId: string
  weekStart: Date
  closed: boolean
}

export type ClearCollectionPlan = {
  ranges: TimelineRange[]
  weeks: ClearCollectionWeek[]
}

function eachWeek(start: Date, last: Date): Date[] {
  const weeks: Date[] = []
  for (let week = start; week <= last; week = addWeeks(week, 1)) {
    weeks.push(week)
  }

  return weeks
}

function contentWeeks(
  content: ClearContent,
  populations: readonly StoredClearPopulation[],
  currentWeek: Date
): Date[] {
  const closedWeeks = new Set(
    populations
      .filter(({ contentId, closed }) => contentId === content.id && closed)
      .map(({ weekStart }) => weekStart.getTime())
  )

  return eachWeek(startOfResetWeek(content.releasedAt), currentWeek).filter(
    (week) => !closedWeeks.has(week.getTime())
  )
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

export function planClearCollection(
  contents: readonly ClearContent[],
  populations: readonly StoredClearPopulation[],
  startedAt: Date
): ClearCollectionPlan {
  const currentWeek = startOfResetWeek(startedAt)
  const released = contents.filter(({ releasedAt }) => releasedAt <= startedAt)
  const weeks = released.flatMap((content) =>
    contentWeeks(content, populations, currentWeek).map((weekStart) => {
      const contentId = content.id
      const closed = weekStart < currentWeek

      return { contentId, weekStart, closed }
    })
  )

  const ranges = toRanges(weeks, startedAt)

  return { ranges, weeks }
}

export const weekKey = (contentId: string, weekStart: Date) =>
  JSON.stringify([contentId, weekStart.getTime()])

function toPopulationJobs(population: readonly ClearPopulationCharacter[]): ClearPopulationJob[] {
  const jobs = new Map<string, ClearPopulationJob>()
  for (const { jobId, jobGrowId, jobName, jobGrowName } of population) {
    const key = JSON.stringify([jobId, jobGrowId])
    const job = jobs.get(key) ?? { jobId, jobGrowId, jobName, jobGrowName, count: 0 }
    jobs.set(key, { ...job, count: job.count + 1 })
  }

  return [...jobs.values()]
}

export function toContentPopulation(
  content: ClearContent,
  population: readonly ClearPopulationCharacter[],
  collectionMinFame: number
): Pick<ContentClearPopulationInput, 'population' | 'minFame' | 'jobs'> {
  const minFame = toPopulationMinFame(content, collectionMinFame)
  const members = population.filter(({ maxFame }) => maxFame >= minFame)
  const jobs = toPopulationJobs(members)

  return { population: members.length, minFame, jobs }
}
