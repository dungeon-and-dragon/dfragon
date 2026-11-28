import { Button, ImageChipGroup, type ImageChipGroupItem } from '@dfragon/ui'
import { type ReactNode, useId } from 'react'
import { ChoiceSelect } from '#shared/ui/ChoiceField'
import { RANKING_JOBS, type RankingGrow, type RankingJob } from '#entities/character'
import type { FameRankingFilter } from '#entities/ranking'
import { growSprite, jobSprite, roleBadgeSprite } from '#widgets/ranking-filter/lib/job-sprites'
import { growFilter, growLabel } from '#widgets/ranking-filter/lib/ranking-jobs'

// 600px 미만에서는 칩, 선택 상자, 버튼, 입력칸을 24px 높이와 12px 글자로 줄인다.
const FILTER_BOX =
  'section flex flex-col gap-3 px-4 max-sm:[&_:is(.chip,.select,.btn,.field-box)]:h-6 max-sm:[&_:is(.chip,.select,.btn)]:px-2 max-sm:[&_:is(.chip,.select,.btn,.field-input)]:text-xs'
// 600px 미만에서는 라벨을 고르는 줄 위에 작은 글자로 둔다.
const FILTER_ROW = 'flex items-start gap-4 max-sm:flex-col max-sm:gap-1'
const FILTER_LABEL = 'label m-0 flex h-8 w-16 shrink-0 items-center max-sm:h-auto max-sm:w-auto'
// 칩 묶음의 값은 문자열이라 직업은 jobId, 전직은 jobGrowId와 역할을 이은 키로 고른다.
const ALL = 'all'

const JOB_CHOICES: readonly ImageChipGroupItem<string>[] = RANKING_JOBS.map((job) => {
  const image = jobSprite(job)

  return { value: job.jobId, label: job.name, image }
})
const JOB_ITEMS: readonly ImageChipGroupItem<string>[] = [
  { value: ALL, label: '직업 전체' },
  ...JOB_CHOICES
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

function growItems(
  job: RankingJob | undefined,
  growRequired: boolean
): ImageChipGroupItem<string>[] {
  const grows =
    job?.grows.map((grow) => {
      const value = growKey(grow)
      const label = growLabel(grow)
      const image = growSprite(job, grow)
      const badge = grow.role !== undefined ? roleBadgeSprite(grow.role) : undefined

      return { value, label, image, badge }
    }) ?? []

  if (growRequired || onlyGrowOf(job) !== undefined) {
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

function jobFilterOf(jobId: string, growRequired: boolean): FameRankingFilter {
  const job = RANKING_JOBS.find((candidate) => candidate.jobId === jobId)

  if (job === undefined) {
    return {}
  }

  const [firstGrow] = job.grows
  if (growRequired && firstGrow !== undefined) {
    return growFilter(job, firstGrow)
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
  rows = [],
  growRequired = false
}: {
  filter: FameRankingFilter
  onChange: (filter: FameRankingFilter) => void
  onReset?: () => void
  rows?: readonly FilterRow[]
  growRequired?: boolean
}): React.JSX.Element {
  const sets = narrowingOf(filter)
  const jobLabelId = useId()
  const growLabelId = useId()
  const job = RANKING_JOBS.find(({ jobId }) => jobId === filter.jobId)
  const growValue = growValueOf(filter, job)

  function selectJob(jobId: string): void {
    const jobFilter = jobFilterOf(jobId, growRequired)

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
        <ImageChoiceField
          label="직업"
          labelId={jobLabelId}
          items={growRequired ? JOB_CHOICES : JOB_ITEMS}
          value={job?.jobId ?? ALL}
          onValueChange={selectJob}
        />
      </div>
      {job === undefined && <GrowRowPlaceholder />}
      {job !== undefined && (
        <div className={FILTER_ROW}>
          <h2 id={growLabelId} className={FILTER_LABEL}>
            전직
          </h2>
          <ImageChoiceField
            label="전직"
            labelId={growLabelId}
            items={growItems(job, growRequired)}
            value={growValue}
            onValueChange={selectGrow}
          />
        </div>
      )}
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

// 그림 칩에는 전체 칩을 두지 않고, 고른 칩을 다시 눌러 풀면 전체를 고른 것으로 본다. 선택 상자는 전체 항목을 그대로 둔다.
function ImageChoiceField({
  label,
  labelId,
  items,
  value,
  onValueChange
}: {
  label: string
  labelId: string
  items: readonly ImageChipGroupItem<string>[]
  value: string
  onValueChange: (value: string) => void
}): React.JSX.Element {
  const hasAll = items.some((item) => item.value === ALL)

  function changeChip(next: string | null): void {
    onValueChange(next ?? ALL)
  }

  return (
    <>
      <div className="max-md:hidden">
        <ImageChipGroup
          aria-labelledby={labelId}
          items={items.filter((item) => item.value !== ALL)}
          value={value === ALL ? null : value}
          onValueChange={changeChip}
          deselectable={hasAll}
        />
      </div>
      <ChoiceSelect label={label} items={items} value={value} onValueChange={onValueChange} />
    </>
  )
}

// 그림 칩 화면에서는 직업을 고를 때 전직 줄이 생기며 아래 내용이 밀리지 않도록 칩 한 줄 높이를 미리 비워 둔다.
function GrowRowPlaceholder(): React.JSX.Element {
  return (
    <div aria-hidden className="invisible max-md:hidden">
      <span className="image-chip box-border" />
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
