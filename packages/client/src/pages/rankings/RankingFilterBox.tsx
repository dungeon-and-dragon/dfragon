import { Chip } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { formatJobName } from '@dfragon/client-core/lib/job-format'
import type { FameRankingFilter } from '@dfragon/client-core/shared/ranking/ranking-stats'
import { RANKING_JOBS } from './ranking-jobs'
import { styles } from './RankingsScreen.style'

export function RankingFilterBox({
  filter,
  onChange
}: {
  filter: FameRankingFilter
  onChange: (filter: FameRankingFilter) => void
}): React.JSX.Element {
  const job = RANKING_JOBS.find(({ jobId }) => jobId === filter.jobId)

  return (
    <div {...stylex.props(styles.filter)}>
      <div {...stylex.props(styles.filterRow)}>
        <h2 {...stylex.props(styles.filterLabel)}>직업</h2>
        <ul {...stylex.props(styles.chips)}>
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
      <div {...stylex.props(styles.filterRow)}>
        <h2 {...stylex.props(styles.filterLabel)}>전직</h2>
        <ul {...stylex.props(styles.chips)}>
          <FilterChip
            label="전직 전체"
            pressed={filter.jobGrowId === undefined}
            value={{ jobId: filter.jobId }}
            onSelect={onChange}
          />
          {job?.grows.map(({ jobGrowId, name }) => (
            <FilterChip
              key={jobGrowId}
              label={formatJobName(name)}
              pressed={jobGrowId === filter.jobGrowId}
              value={{ jobId: job.jobId, jobGrowId }}
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
