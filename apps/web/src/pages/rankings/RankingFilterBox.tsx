import { ChipGroup, type ChipGroupItem } from '@dfragon/ui'
import { type ReactNode, useId } from 'react'
import type { FameRankingFilter } from '#core/ranking'
import {
  growFilter,
  growLabel,
  RANKING_JOBS,
  type RankingGrow,
  type RankingJob
} from './ranking-jobs'

const FILTER_ROW = 'flex items-start gap-4'
const FILTER_LABEL = 'label m-0 flex h-8 w-16 shrink-0 items-center'
// 칩 묶음의 값은 문자열이라 직업은 jobId, 전직은 jobGrowId와 역할을 이은 키로 고른다.
const ALL = 'all'

const JOB_ITEMS: readonly ChipGroupItem<string>[] = [
  { value: ALL, label: '직업 전체' },
  ...RANKING_JOBS.map(({ jobId, name }) => ({ value: jobId, label: name }))
]

function growKey({ jobGrowId, role }: Pick<RankingGrow, 'jobGrowId' | 'role'>): string {
  return `${jobGrowId}/${role ?? ''}`
}

function growItems(job: RankingJob | undefined): ChipGroupItem<string>[] {
  const grows = job?.grows.map((grow) => ({ value: growKey(grow), label: growLabel(grow) })) ?? []

  return [{ value: ALL, label: '전직 전체' }, ...grows]
}

export type FilterRow = Readonly<{ label: string; content: ReactNode }>

function narrowingOf({
  equipmentSetId,
  oathSetId,
  oathSetOption,
  itemIds
}: FameRankingFilter): FameRankingFilter {
  return { equipmentSetId, oathSetId, oathSetOption, itemIds }
}

// 직업, 전직을 바꿔도 세트, 아이템 필터는 그대로 둔다.
export function RankingFilterBox({
  filter,
  onChange,
  rows = []
}: {
  filter: FameRankingFilter
  onChange: (filter: FameRankingFilter) => void
  rows?: readonly FilterRow[]
}): React.JSX.Element {
  const sets = narrowingOf(filter)
  const jobLabelId = useId()
  const growLabelId = useId()
  const job = RANKING_JOBS.find(({ jobId }) => jobId === filter.jobId)
  const growValue =
    filter.jobGrowId !== undefined
      ? growKey({ jobGrowId: filter.jobGrowId, role: filter.role })
      : ALL

  function selectJob(jobId: string): void {
    const jobFilter = jobId === ALL ? {} : { jobId }

    onChange({ ...sets, ...jobFilter })
  }

  function selectGrow(key: string): void {
    const chosen = job?.grows.find((candidate) => growKey(candidate) === key)
    const next =
      job !== undefined && chosen !== undefined ? growFilter(job, chosen) : { jobId: filter.jobId }

    onChange({ ...sets, ...next })
  }

  return (
    <div className="section flex flex-col gap-3 px-4">
      <div className={FILTER_ROW}>
        <h2 id={jobLabelId} className={FILTER_LABEL}>
          직업
        </h2>
        <ChipGroup
          aria-labelledby={jobLabelId}
          items={JOB_ITEMS}
          value={job?.jobId ?? ALL}
          onValueChange={selectJob}
        />
      </div>
      <div className={FILTER_ROW}>
        <h2 id={growLabelId} className={FILTER_LABEL}>
          전직
        </h2>
        <ChipGroup
          aria-labelledby={growLabelId}
          items={growItems(job)}
          value={growValue}
          onValueChange={selectGrow}
        />
      </div>
      {rows.map((row) => (
        <LabeledRow key={row.label} row={row} />
      ))}
    </div>
  )
}

function LabeledRow({ row: { label, content } }: { row: FilterRow }): React.JSX.Element {
  const labelId = useId()

  return (
    <div role="group" aria-labelledby={labelId} className={FILTER_ROW}>
      <h2 id={labelId} className={FILTER_LABEL}>
        {label}
      </h2>
      {content}
    </div>
  )
}
