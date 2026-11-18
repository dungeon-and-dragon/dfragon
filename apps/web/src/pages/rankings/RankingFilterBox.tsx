import { Chip } from '@dfragon/ui'
import type { FameRankingFilter } from '#core/ranking/ranking-stats'
import { growFilter, growLabel, isGrowSelected, RANKING_JOBS } from './ranking-jobs'

const FILTER_ROW = 'flex items-start gap-4'
const FILTER_LABEL = 'm-0 w-12 shrink-0 text-xs leading-8 font-medium text-fg-subtle'
const CHIPS = 'm-0 flex list-none flex-wrap gap-2 p-0'

export function RankingFilterBox({
  filter,
  onChange
}: {
  filter: FameRankingFilter
  onChange: (filter: FameRankingFilter) => void
}): React.JSX.Element {
  const job = RANKING_JOBS.find(({ jobId }) => jobId === filter.jobId)

  return (
    <div className="flex flex-col gap-3 rounded-panel border border-line bg-canvas p-4">
      <div className={FILTER_ROW}>
        <h2 className={FILTER_LABEL}>직업</h2>
        <ul className={CHIPS}>
          <FilterChip
            label="직업 전체"
            pressed={job === undefined}
            value={{}}
            onSelect={onChange}
          />
          {RANKING_JOBS.map(({ jobId, name }) => (
            <FilterChip
              key={jobId}
              label={name}
              pressed={jobId === filter.jobId}
              value={{ jobId }}
              onSelect={onChange}
            />
          ))}
        </ul>
      </div>
      <div className={FILTER_ROW}>
        <h2 className={FILTER_LABEL}>전직</h2>
        <ul className={CHIPS}>
          <FilterChip
            label="전직 전체"
            pressed={filter.jobGrowId === undefined}
            value={{ jobId: filter.jobId }}
            onSelect={onChange}
          />
          {job?.grows.map((grow) => (
            <FilterChip
              key={`${grow.jobGrowId}/${grow.role}`}
              label={growLabel(grow)}
              pressed={isGrowSelected(grow, filter)}
              value={growFilter(job, grow)}
              onSelect={onChange}
            />
          ))}
        </ul>
      </div>
    </div>
  )
}

function FilterChip({
  label,
  pressed,
  value,
  onSelect
}: {
  label: string
  pressed: boolean
  value: FameRankingFilter
  onSelect: (filter: FameRankingFilter) => void
}): React.JSX.Element {
  function select(): void {
    onSelect(value)
  }

  return (
    <li>
      <Chip pressed={pressed} onPressedChange={select}>
        {label}
      </Chip>
    </li>
  )
}
