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

const NAME = 'text-left text-sm font-semibold text-fg focus-ring'
const COLUMN_COUNT = 8
const NO_NEOPLE_GROUP = 'Neople 안 부름'

type JobGroup = {
  label: string
  endpoints: string[]
  jobs: Job[]
}

function groupByNeopleApi(jobs: readonly Job[]): JobGroup[] {
  const groups = new Map<string, JobGroup>()
  const idle: Job[] = []

  for (const job of jobs) {
    if (job.neopleApi === null) {
      idle.push(job)
      continue
    }

    const { group, endpoints } = job.neopleApi
    const current = groups.get(group) ?? { label: group, endpoints: [], jobs: [] }
    current.endpoints = [...new Set([...current.endpoints, ...endpoints])]
    current.jobs.push(job)
    groups.set(group, current)
  }

  const sorted = [...groups.values()].sort((left, right) =>
    left.label.localeCompare(right.label, 'ko')
  )

  if (idle.length > 0) {
    sorted.push({ label: NO_NEOPLE_GROUP, endpoints: [], jobs: idle })
  }

  return sorted
}

function GroupHeader({ group }: { group: JobGroup }): React.JSX.Element {
  return (
    <tr className="bg-surface">
      <th scope="colgroup" colSpan={COLUMN_COUNT} className="whitespace-normal">
        <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-xs font-semibold text-fg-muted">{group.label}</span>
          {group.endpoints.map((endpoint) => (
            <code key={endpoint} className="text-xs text-fg-subtle">
              {endpoint}
            </code>
          ))}
        </span>
      </th>
    </tr>
  )
}

type JobTableProps = {
  jobs: readonly Job[]
  now: Date
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

function JobRow({ job, now }: { job: Job; now: Date }): React.JSX.Element {
  const { activeRun, lastFinishedRun } = job
  const lastDuration = lastFinishedRun !== null ? runDuration(lastFinishedRun, now) : undefined
  const hasDescription = job.description !== ''

  return (
    <tr>
      <td>
        <Tooltip.Root disabled={!hasDescription}>
          <Tooltip.Trigger
            render={
              <span className={textClasses.twoLine}>
                <span tabIndex={hasDescription ? 0 : undefined} className={NAME}>
                  {job.displayName}
                </span>
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

export function JobTable({ jobs, now }: JobTableProps): React.JSX.Element {
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
                <th className="table-num" />
              </tr>
            </thead>
            {groupByNeopleApi(jobs).map((group) => (
              <tbody key={group.label}>
                <GroupHeader group={group} />
                {group.jobs.map((job) => (
                  <JobRow key={job.name} job={job} now={now} />
                ))}
              </tbody>
            ))}
          </table>
        </div>
      ) : (
        <p className="state">등록된 job이 없습니다.</p>
      )}
    </section>
  )
}
