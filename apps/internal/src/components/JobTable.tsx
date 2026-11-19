import { Tooltip } from '@dfragon/ui'
import type { Job } from '#ops-api/ops-schemas'
import {
  EMPTY_VALUE,
  formatDateMinute,
  formatDateSecond,
  formatDuration,
  runDuration
} from '#ops-app/format'
import { panelClasses, textClasses } from './panel-classes'
import { PauseSwitch } from './PauseSwitch'
import { RunJobButton } from './RunJobButton'
import { RunProgress } from './RunProgress'
import { PausedTag, RunStatusTag } from './RunStatusTag'
import { ScheduleText } from './ScheduleText'

const NAME_BUTTON = 'link cursor-pointer text-left text-sm font-semibold text-fg focus-ring'

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

  return <span className="num">{formatDateMinute(job.nextRunAt)}</span>
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
    <tr aria-selected={selected}>
      <td>
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
      <td>
        <ScheduleText schedule={job.schedule} stacked />
      </td>
      <td>
        <NextRun job={job} />
      </td>
      <td>
        {activeRun !== null && (
          <span className={textClasses.inline}>
            <RunStatusTag status={activeRun.status} />
            {activeRun.progress !== null && <RunProgress progress={activeRun.progress} />}
          </span>
        )}
      </td>
      <td>
        {lastFinishedRun?.finishedAt != null && (
          <span className={textClasses.inline}>
            <RunStatusTag status={lastFinishedRun.status} />
            <span className={`${textClasses.muted} num`}>
              {formatDateSecond(lastFinishedRun.finishedAt)}
            </span>
          </span>
        )}
      </td>
      <td className="table-num">{lastDuration !== undefined && formatDuration(lastDuration)}</td>
      <td>
        {job.schedule !== null ? (
          <PauseSwitch job={job} />
        ) : (
          <span className={textClasses.subtle}>{EMPTY_VALUE}</span>
        )}
      </td>
      <td className="text-right">
        <RunJobButton job={job} variant="secondary" />
      </td>
    </tr>
  )
}

export function JobTable({ jobs, selectedName, now, onSelect }: JobTableProps): React.JSX.Element {
  return (
    <section aria-label="job" className={panelClasses.box}>
      <h2 className="section-title">
        Job
        {jobs.length > 0 && <span className="section-title-count">{jobs.length}</span>}
      </h2>
      {jobs.length > 0 ? (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>이름</th>
                <th>스케줄</th>
                <th>다음 실행</th>
                <th>진행</th>
                <th>마지막 실행</th>
                <th className="table-num">걸린 시간</th>
                <th>정기 실행</th>
                <th className="table-num">
                  <span className="sr-only">실행</span>
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
        <p className="state">등록된 job이 없습니다.</p>
      )}
    </section>
  )
}
