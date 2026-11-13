import type {
  ClearFameDistribution,
  ClearJob,
  ClearScoreDistributions,
  ClearScoreKind
} from '#core/ranking/clear-stats'
import type { Choice } from './components/ChoiceGroup'

export type JobMetric = 'fame' | 'score'

export const JOB_METRICS: readonly Choice<JobMetric>[] = [
  { value: 'fame', label: '명성' },
  { value: 'score', label: '장비 점수' }
]

export const JOB_METRIC_PLOT_LABELS: Readonly<Record<JobMetric, string>> = {
  fame: '클리어 캐릭터의 명성',
  score: '클리어 캐릭터의 장비 점수'
}

const integer = new Intl.NumberFormat('ko-KR')

function formatFameTick(value: number): string {
  return integer.format(value)
}

export function jobMetricTickOf(metric: JobMetric): (value: number) => string {
  if (metric === 'score') {
    return formatScoreTick
  }

  return formatFameTick
}

const SCORE_KIND_LABELS: Readonly<Record<ClearScoreKind, string>> = {
  equipment: '장비',
  buff: '버프'
}

const SCORE_KIND_ORDER: readonly ClearScoreKind[] = ['equipment', 'buff']

const compact = new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumFractionDigits: 1 })

export function formatScoreTick(value: number): string {
  return compact.format(value)
}

// 전직의 장비 점수 전환은 딜러의 장비 점수만 그린다. 버퍼의 버프 점수는 단위가 달라 한 축에 둘 수 없다.
export function jobStatsOf(
  job: Pick<ClearJob, 'fame' | 'scores'>,
  metric: JobMetric
): ClearFameDistribution | null {
  if (metric === 'score') {
    return job.scores.equipment
  }

  return job.fame
}

export function hasJobScores(jobs: readonly Pick<ClearJob, 'scores'>[]): boolean {
  return jobs.some(({ scores }) => scores.equipment !== null)
}

export function scoreKindChoices(
  distributions: readonly ClearScoreDistributions[]
): Choice<ClearScoreKind>[] {
  return SCORE_KIND_ORDER.filter((kind) =>
    distributions.some((scores) => scores[kind] !== null)
  ).map((kind) => ({ value: kind, label: SCORE_KIND_LABELS[kind] }))
}

export function bandScoreKindChoices(
  bands: Readonly<Record<ClearScoreKind, readonly unknown[]>>
): Choice<ClearScoreKind>[] {
  return SCORE_KIND_ORDER.filter((kind) => bands[kind].length > 0).map((kind) => ({
    value: kind,
    label: SCORE_KIND_LABELS[kind]
  }))
}
