import type { AdventureActivity } from '@dfragon/client-core/shared/adventure-guild/adventure-activity'

export type ActivityKind = 'all' | 'raid' | 'legion' | 'item' | 'enhance'
export type ActivityDay = AdventureActivity['days'][number]
export type SeasonRange = NonNullable<AdventureActivity['season']>

export type HeatmapDay =
  | Readonly<{ state: 'outside' }>
  | Readonly<{ state: 'future'; date: string }>
  | Readonly<{ state: 'day'; date: string; today: boolean }>

export type HeatmapWeek = Readonly<{ month: number | undefined; days: readonly HeatmapDay[] }>

export type RingHighlight = 'primeval' | 'mythic'

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_DAYS = 7
const THURSDAY = 4
// 하루는 06:00 KST(UTC+9)에 바뀌므로 UTC 시각에 3시간을 더한 날짜가 그 시각이 속한 날이다.
const DAY_START_OFFSET_MS = 3 * 60 * 60 * 1000
const LEVEL_COUNT = 4

function dateKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

function dateMs(date: string): number {
  return Date.parse(`${date}T00:00:00Z`)
}

function activityDateMs(at: number): number {
  return dateMs(dateKey(at + DAY_START_OFFSET_MS))
}

// 시즌 끝은 다음 시즌 시작 시각이라, 그 1ms 앞이 시즌의 마지막 날에 속한다.
function lastSeasonDateMs({ endsAt }: SeasonRange, now: number): number {
  const today = activityDateMs(now)
  if (endsAt === null) {
    return today
  }

  return Math.min(activityDateMs(Date.parse(endsAt) - 1), today)
}

function monthStarting(weekStart: number): number | undefined {
  for (let offset = 0; offset < WEEK_DAYS; offset += 1) {
    const day = new Date(weekStart + offset * DAY_MS)
    if (day.getUTCDate() === 1) {
      return day.getUTCMonth() + 1
    }
  }

  return undefined
}

export function buildHeatmapWeeks(season: SeasonRange, now: number): readonly HeatmapWeek[] {
  const first = activityDateMs(Date.parse(season.timelineStartsAt))
  const last = lastSeasonDateMs(season, now)
  const today = activityDateMs(now)
  const firstWeekStart =
    first - ((new Date(first).getUTCDay() - THURSDAY + WEEK_DAYS) % WEEK_DAYS) * DAY_MS
  const weeks: HeatmapWeek[] = []
  for (let weekStart = firstWeekStart; weekStart <= last; weekStart += WEEK_DAYS * DAY_MS) {
    const days = Array.from({ length: WEEK_DAYS }, (_, offset): HeatmapDay => {
      const day = weekStart + offset * DAY_MS
      if (day < first) {
        return { state: 'outside' }
      }

      if (day > last) {
        if (season.endsAt === null) {
          return { state: 'future', date: dateKey(day) }
        }

        return { state: 'outside' }
      }

      return { state: 'day', date: dateKey(day), today: day === today }
    })
    weeks.push({ month: monthStarting(weekStart), days })
  }

  return weeks
}

export function dayCount(day: ActivityDay, kind: ActivityKind): number {
  switch (kind) {
    case 'all':
      return day.raid + day.legion + day.item + day.enhance
    case 'raid':
      return day.raid
    case 'legion':
      return day.legion
    case 'item':
      return day.item
    case 'enhance':
      return day.enhance
  }
}

// 각 단계의 가장 작은 횟수다. 그 시즌에 활동이 있었던 날의 횟수를 사분위로 나눠, 많은 날일수록 높은 단계가 된다.
export function levelThresholds(counts: readonly number[]): readonly number[] {
  const sorted = counts.filter((count) => count > 0).toSorted((a, b) => a - b)
  if (sorted.length === 0) {
    return []
  }

  return Array.from(
    { length: LEVEL_COUNT - 1 },
    (_, index) => sorted[Math.floor(((index + 1) * sorted.length) / LEVEL_COUNT)]
  )
}

export function heatLevel(count: number, thresholds: readonly number[]): number {
  if (count <= 0) {
    return 0
  }

  return 1 + thresholds.filter((threshold) => count >= threshold).length
}

export function ringHighlight(day: ActivityDay, kind: ActivityKind): RingHighlight | undefined {
  if (kind === 'item') {
    if (day.mythic) {
      return 'mythic'
    }

    if (day.primeval) {
      return 'primeval'
    }

    return undefined
  }

  if (kind === 'enhance' && day.highEnhancement) {
    return 'primeval'
  }

  return undefined
}
