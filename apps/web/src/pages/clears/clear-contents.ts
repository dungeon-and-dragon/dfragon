import type {
  ClearAdventureSize,
  ClearContent,
  ClearContentKind,
  ClearJob,
  ClearWeek
} from '#core/ranking/clear-stats'
import type { Bar } from '../../components/chart/RowBars'

export type ContentRow = Readonly<{ label: string; contents: readonly ClearContent[] }>

const KIND_LABELS: Readonly<Record<ClearContentKind, string>> = {
  raid: '레이드',
  challenge: '챌린지'
}

const OLD_CONTENT_LABEL = '지난 컨텐츠'

// API는 출시 순으로 주므로, 최근 컨텐츠와 같은 레이드의 하드가 앞에 오도록 뒤집는다.
function newestFirst(contents: readonly ClearContent[]): ClearContent[] {
  return contents.toReversed()
}

export function contentRows(contents: readonly ClearContent[]): ContentRow[] {
  const newest = newestFirst(contents)
  const latestOf = (kind: ClearContentKind) =>
    newest.filter((content) => content.latest && content.kind === kind)

  return [
    { label: KIND_LABELS.raid, contents: latestOf('raid') },
    { label: KIND_LABELS.challenge, contents: latestOf('challenge') },
    { label: OLD_CONTENT_LABEL, contents: newest.filter(({ latest }) => !latest) }
  ].filter((row) => row.contents.length > 0)
}

export function findSelectedContent(
  contents: readonly ClearContent[],
  contentId: string | undefined
): ClearContent | undefined {
  const selected = contents.find(({ id }) => id === contentId)
  if (selected !== undefined) {
    return selected
  }

  return contentRows(contents).flatMap((row) => row.contents)[0]
}

export function findSelectedWeek(
  content: ClearContent,
  weekStart: string | undefined
): ClearWeek | undefined {
  const selected = content.weeks.find((week) => week.weekStart === weekStart)
  if (selected !== undefined) {
    return selected
  }

  return content.weeks.at(-1)
}

export function contentKindLabel({ kind, latest }: ClearContent): string {
  if (!latest) {
    return OLD_CONTENT_LABEL
  }

  return KIND_LABELS[kind]
}

export function ratioLabel(ratio: number | null): string {
  if (ratio === null) {
    return '기본'
  }

  return `${100 + ratio}%`
}

export function ratioBars(week: ClearWeek): Bar[] {
  return week.ratios.map(({ ratio, cleared }) => ({
    key: String(ratio),
    name: ratioLabel(ratio),
    value: cleared
  }))
}

export function adventureBars(adventures: readonly ClearAdventureSize[]): Bar[] {
  return adventures.map(({ characters, adventures: count }) => ({
    key: String(characters),
    name: `${characters}명`,
    value: count
  }))
}

export type JobSort = 'rate' | 'cleared'

export type JobRow = Readonly<{
  key: string
  name: string
  population: number
  cleared: number
  rate: number | null
}>

const UNKNOWN_JOB_NAME = '알 수 없음'

function rateOf({ population, cleared }: ClearJob): number | null {
  if (population === 0) {
    return null
  }

  return cleared / population
}

function compareRows(sort: JobSort): (left: JobRow, right: JobRow) => number {
  if (sort === 'cleared') {
    return (left, right) => right.cleared - left.cleared
  }

  return (left, right) => (right.rate ?? -1) - (left.rate ?? -1) || right.cleared - left.cleared
}

export function jobRows(jobs: readonly ClearJob[], sort: JobSort): JobRow[] {
  return jobs
    .map((job) => {
      const key = `${job.jobId}/${job.jobGrowId}`
      const name = job.jobGrowName ?? UNKNOWN_JOB_NAME

      return {
        key,
        name,
        population: job.population,
        cleared: job.cleared,
        rate: rateOf(job)
      }
    })
    .toSorted(compareRows(sort))
}
