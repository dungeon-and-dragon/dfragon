import { colors } from '@dfragon/ui/tokens.stylex'
import type {
  ClearAdventureSize,
  ClearContent,
  ClearContentKind,
  ClearOverview,
  ClearOverviewJob,
  ClearWeek
} from '#core/ranking/clear-stats'
import type { BoxPlotRow } from '../../components/chart/BoxPlot'
import type { ColumnBar } from '../../components/chart/Columns'
import type { LineSeries } from '../../components/chart/LineChart'
import type { ChartX } from '../../components/chart/plot-layout'
import type { Bar } from '../../components/chart/RowBars'
import { shareText } from '../../components/chart/stats-bars'
import { addDays } from './clear-weeks'

export type ClearStage = '하드' | '일반'

type ClearGroup = Readonly<{ key: string; name: string; shortName: string; color: string }>

type ContentPlace = Readonly<{ group: ClearGroup; stage: ClearStage | null }>

const MICHAELA: ClearGroup = {
  key: 'michaela',
  name: '무너진 성자 미카엘라',
  shortName: '미카엘라',
  color: colors.chart1
}
const DIREGIE: ClearGroup = {
  key: 'diregie',
  name: '디레지에 레이드',
  shortName: '디레지에',
  color: colors.chart2
}
const INAE: ClearGroup = {
  key: 'inae',
  name: '이내 황혼전',
  shortName: '이내 황혼전',
  color: colors.chart3
}
const NABEL: ClearGroup = {
  key: 'nabel',
  name: '만들어진 신 나벨',
  shortName: '나벨',
  color: colors.chart4
}
const NIGHTMARE: ClearGroup = {
  key: 'nightmare',
  name: '각인된 악몽',
  shortName: '각인된 악몽',
  color: colors.chart7
}

// 같은 레이드의 일반과 하드를 카드 하나로 묶고, 기간이나 전환을 바꿔도 같은 색을 쓰게 컨텐츠마다 묶음을 고정한다(ADR 0055).
const CONTENT_PLACES = new Map<string, ContentPlace>([
  ['michaela-hard', { group: MICHAELA, stage: '하드' }],
  ['michaela-normal', { group: MICHAELA, stage: '일반' }],
  ['diregie-hard', { group: DIREGIE, stage: '하드' }],
  ['diregie-normal', { group: DIREGIE, stage: '일반' }],
  ['inae-twilight', { group: INAE, stage: null }],
  ['nabel-hard', { group: NABEL, stage: '하드' }],
  ['nabel-normal', { group: NABEL, stage: '일반' }],
  ['engraved-nightmare-1', { group: NIGHTMARE, stage: null }]
])

const STAGE_ORDER: readonly (ClearStage | null)[] = ['하드', '일반', null]

const KIND_LABELS: Readonly<Record<ClearContentKind, string>> = {
  raid: '레이드',
  challenge: '챌린지'
}

const percent = new Intl.NumberFormat('ko-KR', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
})
const integer = new Intl.NumberFormat('ko-KR')

function placeOf({ id, name }: ClearContent): ContentPlace {
  const known = CONTENT_PLACES.get(id)
  if (known !== undefined) {
    return known
  }

  return { group: { key: id, name, shortName: name, color: colors.chartBase }, stage: null }
}

export function contentLabelOf(content: ClearContent): string {
  const { group, stage } = placeOf(content)
  if (stage === null) {
    return group.shortName
  }

  return `${group.shortName} ${stage}`
}

function rateOf({ cleared, population }: ClearWeek): number | null {
  if (population <= 0) {
    return null
  }

  return cleared / population
}

function weekOf(content: ClearContent, weekStart: string): ClearWeek | undefined {
  return content.weeks.find((week) => week.weekStart === weekStart)
}

export type OverviewWeek = Readonly<{ weekStart: string; closed: boolean }>

export function overviewWeeks(contents: readonly ClearContent[]): OverviewWeek[] {
  const weeks = new Map<string, boolean>()
  for (const { weekStart, closed } of contents.flatMap((content) => content.weeks)) {
    weeks.set(weekStart, (weeks.get(weekStart) ?? true) && closed)
  }

  return [...weeks]
    .map(([weekStart, closed]) => ({ weekStart, closed }))
    .toSorted((left, right) => left.weekStart.localeCompare(right.weekStart))
}

export function findOverviewWeek(
  weeks: readonly OverviewWeek[],
  weekStart: string | undefined
): OverviewWeek | undefined {
  const chosen = weeks.find((week) => week.weekStart === weekStart)
  if (chosen !== undefined) {
    return chosen
  }

  return weeks.at(-1)
}

export function weekRangeText(weekStart: string): string {
  const weekEnd = addDays(weekStart, 6)

  return `${weekStart.slice(5)} ~ ${weekEnd.slice(5)}`
}

export type WeekSummary = Readonly<{
  minFame: number | null
  population: number
  collectedAt: string
}>

// 컨텐츠마다 입장 명성으로 분모를 거르므로, 그 주에 가장 넓은 분모를 화면 전체의 기준으로 보인다.
export function weekSummaryOf(
  contents: readonly ClearContent[],
  weekStart: string
): WeekSummary | undefined {
  const weeks = contents.flatMap((content) => weekOf(content, weekStart) ?? [])
  const widest = weeks.reduce<ClearWeek | undefined>(
    (best, week) => (best === undefined || week.population > best.population ? week : best),
    undefined
  )
  if (widest === undefined) {
    return undefined
  }

  const collectedAt = weeks
    .map((week) => week.collectedAt)
    .reduce((latest, at) => (at > latest ? at : latest))

  return { minFame: widest.minFame, population: widest.population, collectedAt }
}

export type Trend = 'up' | 'down' | 'flat'

export type CardStage = Readonly<{
  contentId: string
  stage: ClearStage | null
  rate: string
  change: Readonly<{ text: string; trend: Trend }> | null
  cleared: string
}>

export type ContentCard = Readonly<{
  key: string
  kind: string
  name: string
  backgroundId: string
  stages: readonly CardStage[]
}>

type GroupedContent = Readonly<{ content: ClearContent; place: ContentPlace }>

function changeOf(content: ClearContent, weekStart: string, rate: number): CardStage['change'] {
  const previous = weekOf(content, addDays(weekStart, -7))
  const previousRate = previous !== undefined ? rateOf(previous) : null
  if (previousRate === null) {
    return null
  }

  const points = Math.round((rate - previousRate) * 1000) / 10
  if (points > 0) {
    return { text: `▲ ${points.toFixed(1)}%p`, trend: 'up' }
  }

  if (points < 0) {
    return { text: `▼ ${Math.abs(points).toFixed(1)}%p`, trend: 'down' }
  }

  return { text: '0.0%p', trend: 'flat' }
}

function groupsOf(contents: readonly ClearContent[]): GroupedContent[][] {
  const groups = new Map<string, GroupedContent[]>()
  for (const content of contents) {
    const place = placeOf(content)
    groups.set(place.group.key, [...(groups.get(place.group.key) ?? []), { content, place }])
  }

  const releaseOf = (group: readonly GroupedContent[]) =>
    Math.min(...group.map(({ content }) => Date.parse(content.releasedAt)))

  return [...groups.values()]
    .map((group) =>
      group.toSorted(
        (left, right) =>
          STAGE_ORDER.indexOf(left.place.stage) - STAGE_ORDER.indexOf(right.place.stage)
      )
    )
    .toSorted((left, right) => releaseOf(right) - releaseOf(left))
}

export function contentCards(contents: readonly ClearContent[], weekStart: string): ContentCard[] {
  return groupsOf(contents).flatMap((group) => {
    const stages = group.flatMap(({ content, place }) => {
      const week = weekOf(content, weekStart)
      const rate = week !== undefined ? rateOf(week) : null
      if (week === undefined || rate === null) {
        return []
      }

      const rateText = percent.format(rate)
      const change = changeOf(content, weekStart, rate)
      const cleared = integer.format(week.cleared)

      return [{ contentId: content.id, stage: place.stage, rate: rateText, change, cleared }]
    })
    const first = group[0]
    if (first === undefined || stages.length === 0) {
      return []
    }

    return [
      {
        key: first.place.group.key,
        kind: KIND_LABELS[first.content.kind],
        name: first.place.group.name,
        backgroundId: first.content.id,
        stages
      }
    ]
  })
}

export function orderedContents(contents: readonly ClearContent[]): ClearContent[] {
  return groupsOf(contents).flatMap((group) => group.map(({ content }) => content))
}

export type RatePeriod = 'quarter' | 'half' | 'year' | 'all'

export const RATE_PERIODS: readonly { period: RatePeriod; label: string }[] = [
  { period: 'quarter', label: '3개월' },
  { period: 'half', label: '6개월' },
  { period: 'year', label: '1년' },
  { period: 'all', label: '전체' }
]

const PERIOD_WEEKS: Readonly<Record<RatePeriod, number>> = {
  quarter: 13,
  half: 26,
  year: 52,
  all: Number.POSITIVE_INFINITY
}

export type RateStage = 'hard' | 'normal'

export const RATE_STAGES: readonly { stage: RateStage; label: ClearStage }[] = [
  { stage: 'hard', label: '하드' },
  { stage: 'normal', label: '일반' }
]

const AXIS_STEP = 4

function axisTickOf(count: number): (weekStart: string, index: number) => string | null {
  return (weekStart, index) => {
    if ((count - 1 - index) % AXIS_STEP !== 0) {
      return null
    }

    return weekStart.slice(5)
  }
}

export type RateChart = Readonly<{ x: ChartX[]; series: LineSeries[] }>

// 챌린지는 누적 클리어라 주간 클리어율 선에 넣지 않는다.
export function clearRateChart(
  contents: readonly ClearContent[],
  weeks: readonly OverviewWeek[],
  weekStart: string,
  period: RatePeriod,
  stage: RateStage
): RateChart {
  const shown = weeks
    .filter((week) => week.weekStart <= weekStart)
    .slice(-PERIOD_WEEKS[period])
    .map((week) => week.weekStart)
  const tickOf = axisTickOf(shown.length)
  const x = shown.map((start, index) => {
    const title = weekRangeText(start)
    const tick = tickOf(start, index)

    return { key: start, title, tick }
  })
  const wanted = RATE_STAGES.find((option) => option.stage === stage)?.label

  const series = groupsOf(contents).flatMap((group) => {
    const picked = group.find(
      ({ content, place }) =>
        content.kind === 'raid' && (place.stage === null || place.stage === wanted)
    )
    if (picked === undefined) {
      return []
    }

    const { content, place } = picked
    const values = shown.map((start) => {
      const week = weekOf(content, start)
      if (week === undefined) {
        return null
      }

      const rate = rateOf(week)
      if (rate === null) {
        return null
      }

      return rate * 100
    })
    const name = contentLabelOf(content)

    return [{ key: content.id, name, color: place.group.color, values }]
  })

  return { x, series }
}

export function hasRateValues(contents: readonly ClearContent[]): boolean {
  return contents.some(({ kind, weeks }) => kind === 'raid' && weeks.length > 0)
}

export function fameRows(overview: ClearOverview, contents: readonly ClearContent[]): BoxPlotRow[] {
  return overview.contents
    .flatMap(({ id, fame }) => {
      const content = contents.find((candidate) => candidate.id === id)
      if (content === undefined || fame === null) {
        return []
      }

      const { group, stage } = placeOf(content)
      const sub = stage ?? undefined
      const faded = stage === '일반'

      return [{ key: id, name: group.shortName, sub, color: group.color, faded, stats: fame }]
    })
    .toSorted((left, right) => right.stats.median - left.stats.median)
}

export type BaseContentOption = Readonly<{ id: string; label: string }>

export function baseContentOptions(
  overview: ClearOverview,
  contents: readonly ClearContent[]
): BaseContentOption[] {
  const ids = new Set(overview.contents.map(({ id }) => id))

  return orderedContents(contents)
    .filter(({ id }) => ids.has(id))
    .map((content) => {
      const label = contentLabelOf(content)

      return { id: content.id, label }
    })
}

export function defaultBaseContentId(
  options: readonly BaseContentOption[],
  contents: readonly ClearContent[]
): string | undefined {
  const raid = options.find(
    ({ id }) => contents.find((content) => content.id === id)?.kind === 'raid'
  )
  if (raid !== undefined) {
    return raid.id
  }

  return options[0]?.id
}

const JOB_RANK_SIZE = 8
const UNKNOWN_JOB_NAME = '알 수 없음'

export type JobRanks = Readonly<{ high: BoxPlotRow[]; low: BoxPlotRow[] }>

function jobRowOf(job: ClearOverviewJob, rate: number): BoxPlotRow | null {
  if (job.fame === null) {
    return null
  }

  const name = job.jobGrowName ?? UNKNOWN_JOB_NAME
  const sub = job.jobName ?? undefined
  const value = percent.format(rate)

  return {
    key: `${job.jobId}/${job.jobGrowId}`,
    name,
    sub,
    color: colors.chart1,
    stats: job.fame,
    value
  }
}

export function jobRanks(jobs: readonly ClearOverviewJob[]): JobRanks {
  const rows = jobs
    .flatMap((job) => {
      if (job.population === 0) {
        return []
      }

      const rate = job.cleared / job.population
      const row = jobRowOf(job, rate)
      if (row === null) {
        return []
      }

      return [{ row, rate }]
    })
    .toSorted((left, right) => right.rate - left.rate)
    .map(({ row }) => row)
  const high = rows.slice(0, JOB_RANK_SIZE)
  const low = rows.slice(JOB_RANK_SIZE).toReversed().slice(0, JOB_RANK_SIZE)

  return { high, low }
}

const WEEKDAY_NAMES: Readonly<Record<number, string>> = {
  1: '월',
  2: '화',
  3: '수',
  4: '목',
  5: '금',
  6: '토',
  7: '일'
}

const HOUR_TICK_STEP = 6

function columnsOf(
  counts: readonly { key: string; label: string | null; range: string; cleared: number }[]
): ColumnBar[] {
  const max = Math.max(0, ...counts.map(({ cleared }) => cleared))
  const total = counts.reduce((sum, { cleared }) => sum + cleared, 0)

  return counts.map(({ key, label, range, cleared }) => {
    const share = shareText(cleared, total)
    const ratio = max > 0 ? cleared / max : 0

    return { key, label, range, count: cleared, share, ratio }
  })
}

export function weekdayColumns(overview: ClearOverview): ColumnBar[] {
  return columnsOf(
    overview.weekdays.map(({ weekday, cleared }) => {
      const key = String(weekday)
      const name = WEEKDAY_NAMES[weekday] ?? key

      return { key, label: name, range: `${name}요일`, cleared }
    })
  )
}

export function hourColumns(overview: ClearOverview): ColumnBar[] {
  return columnsOf(
    overview.hours.map(({ hour, cleared }) => {
      const key = String(hour)
      const label = hour % HOUR_TICK_STEP === 0 ? `${hour}시` : null

      return { key, label, range: `${hour}시`, cleared }
    })
  )
}

export function hasClearTimes(overview: ClearOverview): boolean {
  return overview.weekdays.some(({ cleared }) => cleared > 0)
}

export function coClearBars(
  overview: ClearOverview,
  contents: readonly ClearContent[],
  baseId: string
): Bar[] {
  const base = overview.contents.find(({ id }) => id === baseId)
  if (base === undefined || base.cleared === 0) {
    return []
  }

  return base.coClears
    .flatMap(({ id, cleared }) => {
      const content = contents.find((candidate) => candidate.id === id)
      if (content === undefined) {
        return []
      }

      const name = contentLabelOf(content)
      const value = cleared / base.cleared
      const share = integer.format(cleared)

      return [{ key: id, name, value, share }]
    })
    .toSorted((left, right) => right.value - left.value)
}

export function formatPercent(value: number): string {
  return percent.format(value)
}

const LAST_ADVENTURE_SIZE = 13

export function adventureColumns(adventures: readonly ClearAdventureSize[]): ColumnBar[] {
  const sizes = Array.from({ length: LAST_ADVENTURE_SIZE }, (_, index) => index + 1)

  return columnsOf(
    sizes.map((size) => {
      const last = size === LAST_ADVENTURE_SIZE
      const cleared = adventures
        .filter(({ characters }) => (last ? characters >= size : characters === size))
        .reduce((sum, { adventures: count }) => sum + count, 0)
      const key = String(size)
      const label = last ? `${size}+` : key
      const range = last ? `${size}명 이상` : `${size}명`

      return { key, label, range, cleared }
    })
  )
}
