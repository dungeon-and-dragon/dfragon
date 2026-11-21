import { Button, type ChipGroupItem } from '@dfragon/ui'
import { type ReactNode, useId } from 'react'
import { ChoiceField } from '#shared/ui/ChoiceField'
import { RANKING_JOBS, type RankingGrow, type RankingJob } from '#entities/character'
import type { FameRankingFilter } from '#entities/ranking'
import { growFilter, growLabel } from '#widgets/ranking-filter/lib/ranking-jobs'

// 600px 미만에서는 칩, 선택 상자, 버튼, 입력칸을 24px 높이와 12px 글자로 줄인다.
const FILTER_BOX =
  'section flex flex-col gap-3 px-4 max-sm:[&_:is(.chip,.select,.btn,.field-box)]:h-6 max-sm:[&_:is(.chip,.select,.btn)]:px-2 max-sm:[&_:is(.chip,.select,.btn,.field-input)]:text-xs'
// 600px 미만에서는 라벨을 고르는 줄 위에 작은 글자로 둔다.
const FILTER_ROW = 'flex items-start gap-4 max-sm:flex-col max-sm:gap-1'
const FILTER_LABEL = 'label m-0 flex h-8 w-16 shrink-0 items-center max-sm:h-auto max-sm:w-auto'
// 칩 묶음의 값은 문자열이라 직업은 jobId, 전직은 jobGrowId와 역할을 이은 키로 고른다.
const ALL = 'all'

const JOB_ITEMS: readonly ChipGroupItem<string>[] = [
  { value: ALL, label: '직업 전체' },
  ...RANKING_JOBS.map(({ jobId, name }) => ({ value: jobId, label: name }))
]

function growKey({ jobGrowId, role }: Pick<RankingGrow, 'jobGrowId' | 'role'>): string {
  return `${jobGrowId}/${role ?? ''}`
}

// 전직이 하나뿐인 직업은 전직 전체가 그 전직과 같으므로, 전직 전체 칩 없이 그 전직을 고른 채로 둔다.
function onlyGrowOf(job: RankingJob | undefined): RankingGrow | undefined {
  if (job === undefined || job.grows.length !== 1) {
    return undefined
  }

  return job.grows[0]
}

function growItems(job: RankingJob | undefined): ChipGroupItem<string>[] {
  const grows = job?.grows.map((grow) => ({ value: growKey(grow), label: growLabel(grow) })) ?? []

  if (onlyGrowOf(job) !== undefined) {
    return grows
  }

  return [{ value: ALL, label: '전직 전체' }, ...grows]
}

function growValueOf(filter: FameRankingFilter, job: RankingJob | undefined): string {
  if (filter.jobGrowId !== undefined) {
    return growKey({ jobGrowId: filter.jobGrowId, role: filter.role })
  }

  const onlyGrow = onlyGrowOf(job)
  if (onlyGrow !== undefined) {
    return growKey(onlyGrow)
  }

  return ALL
}

function jobFilterOf(jobId: string): FameRankingFilter {
  const job = RANKING_JOBS.find((candidate) => candidate.jobId === jobId)

  if (job === undefined) {
    return {}
  }

  const onlyGrow = onlyGrowOf(job)
  if (onlyGrow !== undefined) {
    return growFilter(job, onlyGrow)
  }

  return { jobId }
}

export type FilterRow = Readonly<{ label: string; content: ReactNode }>

function narrowingOf({
  equipmentSetId,
  oathSetId,
  oathSetOption,
  itemIds,
  sort,
  fameFrom,
  fameTo,
  scoreFrom,
  scoreTo
}: FameRankingFilter): FameRankingFilter {
  return {
    equipmentSetId,
    oathSetId,
    oathSetOption,
    itemIds,
    sort,
    fameFrom,
    fameTo,
    scoreFrom,
    scoreTo
  }
}

function hasFilter(filter: FameRankingFilter): boolean {
  return Object.values(filter).some(
    (value) => value !== undefined && !(Array.isArray(value) && value.length === 0)
  )
}

// 직업, 전직을 바꿔도 세트, 아이템, 검색 기준과 범위는 그대로 두고 그 전직의 개화 선택만 버린다.
export function RankingFilterBox({
  filter,
  onChange,
  onReset,
  rows = []
}: {
  filter: FameRankingFilter
  onChange: (filter: FameRankingFilter) => void
  onReset?: () => void
  rows?: readonly FilterRow[]
}): React.JSX.Element {
  const sets = narrowingOf(filter)
  const jobLabelId = useId()
  const growLabelId = useId()
  const job = RANKING_JOBS.find(({ jobId }) => jobId === filter.jobId)
  const growValue = growValueOf(filter, job)

  function selectJob(jobId: string): void {
    const jobFilter = jobFilterOf(jobId)

    onChange({ ...sets, ...jobFilter })
  }

  function selectGrow(key: string): void {
    const chosen = job?.grows.find((candidate) => growKey(candidate) === key)
    const next =
      job !== undefined && chosen !== undefined ? growFilter(job, chosen) : { jobId: filter.jobId }

    onChange({ ...sets, ...next })
  }

  return (
    <div className={FILTER_BOX}>
      <div className={FILTER_ROW}>
        <h2 id={jobLabelId} className={FILTER_LABEL}>
          직업
        </h2>
        <ChoiceField
          label="직업"
          labelId={jobLabelId}
          items={JOB_ITEMS}
          value={job?.jobId ?? ALL}
          onValueChange={selectJob}
        />
      </div>
      <div className={FILTER_ROW}>
        <h2 id={growLabelId} className={FILTER_LABEL}>
          전직
        </h2>
        <ChoiceField
          label="전직"
          labelId={growLabelId}
          items={growItems(job)}
          value={growValue}
          onValueChange={selectGrow}
        />
      </div>
      {rows.map((row) => (
        <LabeledRow key={row.label} row={row} />
      ))}
      {onReset !== undefined && (
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" disabled={!hasFilter(filter)} onClick={onReset}>
            초기화
          </Button>
        </div>
      )}
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
