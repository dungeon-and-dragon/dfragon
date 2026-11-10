import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import type { Job } from '../api/ops-schemas'
import {
  EMPTY_VALUE,
  formatDateMinute,
  formatDateSecond,
  formatDuration,
  runDuration
} from '../format'
import { styles } from './JobTable.style'
import { panelStyles, tableStyles, textStyles } from './panel.style'
import { PauseSwitch } from './PauseSwitch'
import { RunJobButton } from './RunJobButton'
import { RunProgress } from './RunProgress'
import { PausedTag, RunStatusTag } from './RunStatusTag'
import { ScheduleText } from './ScheduleText'

type JobTableProps = {
  jobs: readonly Job[]
  selectedName: string | undefined
  now: Date
  onSelect: (name: string) => void
}

function NextRun({ job }: { job: Job }): React.JSX.Element {
  if (job.paused) {
    return <PausedTag />
  }

  if (job.nextRunAt === null) {
    return <span {...stylex.props(textStyles.subtle)}>{EMPTY_VALUE}</span>
  }

  return <span {...stylex.props(textStyles.numeric)}>{formatDateMinute(job.nextRunAt)}</span>
}

function JobRow({
  job,
  selected,
  now,
  onSelect
}: {
  job: Job
  selected: boolean
  now: Date
  onSelect: (name: string) => void
}): React.JSX.Element {
  const { activeRun, lastFinishedRun } = job
  const lastDuration = lastFinishedRun !== null ? runDuration(lastFinishedRun, now) : undefined

  function handleSelect(): void {
    onSelect(job.name)
  }

  return (
    <tr
      {...stylex.props(tableStyles.row, tableStyles.tallRow, selected && tableStyles.selectedRow)}
    >
      <td {...stylex.props(tableStyles.cell)}>
        <span {...stylex.props(textStyles.twoLine)}>
          <button
            type="button"
            aria-pressed={selected}
            onClick={handleSelect}
            {...stylex.props(styles.name)}
          >
            {job.displayName}
          </button>
          <small {...stylex.props(textStyles.small)}>{job.name}</small>
        </span>
      </td>
      <td {...stylex.props(tableStyles.cell)}>
        <ScheduleText schedule={job.schedule} stacked />
      </td>
      <td {...stylex.props(tableStyles.cell)}>
        <NextRun job={job} />
      </td>
      <td {...stylex.props(tableStyles.cell)}>
        {activeRun !== null && (
          <span {...stylex.props(textStyles.inline)}>
            <RunStatusTag status={activeRun.status} />
            {activeRun.progress !== null && <RunProgress progress={activeRun.progress} />}
          </span>
        )}
      </td>
      <td {...stylex.props(tableStyles.cell)}>
        {lastFinishedRun?.finishedAt != null && (
          <span {...stylex.props(textStyles.inline)}>
            <RunStatusTag status={lastFinishedRun.status} />
            <span {...stylex.props(textStyles.muted, textStyles.numeric)}>
              {formatDateSecond(lastFinishedRun.finishedAt)}
            </span>
          </span>
        )}
      </td>
      <td {...stylex.props(tableStyles.cell, tableStyles.end, tableStyles.numeric)}>
        {lastDuration !== undefined && formatDuration(lastDuration)}
      </td>
      <td {...stylex.props(tableStyles.cell)}>
        {job.schedule !== null ? (
          <PauseSwitch job={job} />
        ) : (
          <span {...stylex.props(textStyles.subtle)}>{EMPTY_VALUE}</span>
        )}
      </td>
      <td {...stylex.props(tableStyles.cell, tableStyles.end)}>
        <RunJobButton job={job} variant="secondary" />
      </td>
    </tr>
  )
}

export function JobTable({ jobs, selectedName, now, onSelect }: JobTableProps): React.JSX.Element {
  return (
    <section aria-label="job" {...stylex.props(panelStyles.box)}>
      <h2 {...stylex.props(panelStyles.heading)}>
        Job
        {jobs.length > 0 && <span {...stylex.props(panelStyles.headingCount)}>{jobs.length}</span>}
      </h2>
      {jobs.length > 0 ? (
        <div {...stylex.props(panelStyles.scroll)}>
          <table {...stylex.props(tableStyles.table)}>
            <thead>
              <tr>
                <th {...stylex.props(tableStyles.headerCell)}>이름</th>
                <th {...stylex.props(tableStyles.headerCell)}>스케줄</th>
                <th {...stylex.props(tableStyles.headerCell)}>다음 실행</th>
                <th {...stylex.props(tableStyles.headerCell)}>진행</th>
                <th {...stylex.props(tableStyles.headerCell)}>마지막 실행</th>
                <th {...stylex.props(tableStyles.headerCell, tableStyles.end)}>걸린 시간</th>
                <th {...stylex.props(tableStyles.headerCell)}>정기 실행</th>
                <th {...stylex.props(tableStyles.headerCell, tableStyles.end)}>
                  <span {...stylex.props(shapes.srOnly)}>실행</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <JobRow
                  key={job.name}
                  job={job}
                  selected={job.name === selectedName}
                  now={now}
                  onSelect={onSelect}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p {...stylex.props(panelStyles.empty)}>등록된 job이 없습니다.</p>
      )}
    </section>
  )
}
