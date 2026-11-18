import { Tooltip } from '@dfragon/ui'
import type { Job } from '../api/ops-schemas'
import {
  EMPTY_VALUE,
  formatDateMinute,
  formatDateSecond,
  formatDuration,
  runDuration
} from '../format'
import { panelClasses, tableClasses, textClasses } from './panel-classes'
import { PauseSwitch } from './PauseSwitch'
import { RunJobButton } from './RunJobButton'
import { RunProgress } from './RunProgress'
import { PausedTag, RunStatusTag } from './RunStatusTag'
import { ScheduleText } from './ScheduleText'

const NAME_BUTTON =
  'cursor-pointer text-left text-sm font-semibold text-fg hover:underline focus-ring'

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
    return <span className={textClasses.subtle}>{EMPTY_VALUE}</span>
  }

  return <span className={textClasses.numeric}>{formatDateMinute(job.nextRunAt)}</span>
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
  const rowClassName = selected
    ? `${tableClasses.row} ${tableClasses.selectedRow}`
    : tableClasses.row

  function handleSelect(): void {
    onSelect(job.name)
  }

  return (
    <tr className={rowClassName}>
      <td className={tableClasses.cell}>
        <Tooltip.Root disabled={job.description === ''}>
          <Tooltip.Trigger
            render={
              <span className={textClasses.twoLine}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={handleSelect}
                  className={NAME_BUTTON}
                >
                  {job.displayName}
                </button>
                <small className={textClasses.small}>{job.name}</small>
              </span>
            }
          />
          <Tooltip.Popup align="start">{job.description}</Tooltip.Popup>
        </Tooltip.Root>
      </td>
      <td className={tableClasses.cell}>
        <ScheduleText schedule={job.schedule} stacked />
      </td>
      <td className={tableClasses.cell}>
        <NextRun job={job} />
      </td>
      <td className={tableClasses.cell}>
        {activeRun !== null && (
          <span className={textClasses.inline}>
            <RunStatusTag status={activeRun.status} />
            {activeRun.progress !== null && <RunProgress progress={activeRun.progress} />}
          </span>
        )}
      </td>
      <td className={tableClasses.cell}>
        {lastFinishedRun?.finishedAt != null && (
          <span className={textClasses.inline}>
            <RunStatusTag status={lastFinishedRun.status} />
            <span className={`${textClasses.muted} ${textClasses.numeric}`}>
              {formatDateSecond(lastFinishedRun.finishedAt)}
            </span>
          </span>
        )}
      </td>
      <td className={`${tableClasses.cellEnd} ${textClasses.numeric}`}>
        {lastDuration !== undefined && formatDuration(lastDuration)}
      </td>
      <td className={tableClasses.cell}>
        {job.schedule !== null ? (
          <PauseSwitch job={job} />
        ) : (
          <span className={textClasses.subtle}>{EMPTY_VALUE}</span>
        )}
      </td>
      <td className={tableClasses.cellEnd}>
        <RunJobButton job={job} variant="secondary" />
      </td>
    </tr>
  )
}

export function JobTable({ jobs, selectedName, now, onSelect }: JobTableProps): React.JSX.Element {
  return (
    <section aria-label="job" className={panelClasses.box}>
      <h2 className={panelClasses.heading}>
        Job
        {jobs.length > 0 && <span className={panelClasses.headingCount}>{jobs.length}</span>}
      </h2>
      {jobs.length > 0 ? (
        <div className={panelClasses.scroll}>
          <table className={tableClasses.table}>
            <thead>
              <tr>
                <th className={tableClasses.headCell}>이름</th>
                <th className={tableClasses.headCell}>스케줄</th>
                <th className={tableClasses.headCell}>다음 실행</th>
                <th className={tableClasses.headCell}>진행</th>
                <th className={tableClasses.headCell}>마지막 실행</th>
                <th className={tableClasses.headCellEnd}>걸린 시간</th>
                <th className={tableClasses.headCell}>정기 실행</th>
                <th className={tableClasses.headCellEnd}>
                  <span className="sr-only">실행</span>
                </th>
              </tr>
            </thead>
            <tbody className={tableClasses.body}>
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
        <p className={panelClasses.empty}>등록된 job이 없습니다.</p>
      )}
    </section>
  )
}
