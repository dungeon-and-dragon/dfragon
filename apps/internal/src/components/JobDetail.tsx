import { Button } from '@dfragon/ui'
import type { Job, Run } from '../api/ops-schemas'
import {
  EMPTY_VALUE,
  formatDateMinute,
  formatDateSecond,
  formatDuration,
  formatSummary,
  runDuration,
  TRIGGER_LABELS
} from '../format'
import { useJobRuns } from '../ops-queries'
import { argInputs } from '../run-args'
import { panelClasses, tableClasses, textClasses } from './panel-classes'
import { PauseSwitch } from './PauseSwitch'
import { RunJobButton } from './RunJobButton'
import { RunProgress } from './RunProgress'
import { PausedTag, RunStatusTag } from './RunStatusTag'
import { ScheduleText } from './ScheduleText'

const FACT =
  'flex flex-col gap-1 border-r border-line px-4 py-3 last:border-r-0 max-sm:even:border-r-0 max-sm:nth-[-n+2]:border-b'
const ACTIVE_VALUE = 'font-mono font-medium tabular-nums text-fg'

function Blank(): React.JSX.Element {
  return <span className={textClasses.subtle}>{EMPTY_VALUE}</span>
}

function NextRunValue({ job }: { job: Job }): React.JSX.Element {
  if (job.paused) {
    return <PausedTag />
  }

  if (job.nextRunAt === null) {
    return <Blank />
  }

  return <span className={textClasses.numeric}>{formatDateMinute(job.nextRunAt)}</span>
}

function ActiveRun({ run, now }: { run: Run; now: Date }): React.JSX.Element {
  const elapsed = runDuration(run, now)

  return (
    <div className="flex flex-wrap items-center gap-4 border-b border-line px-4 py-3">
      <RunStatusTag status={run.status} />
      {run.progress !== null && <RunProgress progress={run.progress} wide />}
      <span className="flex flex-wrap gap-x-6 text-fg-muted">
        <span>{TRIGGER_LABELS[run.trigger]}</span>
        {run.startedAt !== null ? (
          <span>
            시작 <b className={ACTIVE_VALUE}>{formatDateSecond(run.startedAt)}</b>
          </span>
        ) : (
          <span>
            요청 <b className={ACTIVE_VALUE}>{formatDateSecond(run.requestedAt)}</b>
          </span>
        )}
        {elapsed !== undefined && (
          <span>
            경과 <b className={ACTIVE_VALUE}>{formatDuration(elapsed)}</b>
          </span>
        )}
      </span>
    </div>
  )
}

function RunRow({ run, now }: { run: Run; now: Date }): React.JSX.Element {
  const duration = runDuration(run, now)
  const [error] = run.error ?? []

  return (
    <tr className={tableClasses.row}>
      <td className={`${tableClasses.cell} ${textClasses.muted}`}>{TRIGGER_LABELS[run.trigger]}</td>
      <td className={tableClasses.cell}>
        <RunStatusTag status={run.status} />
      </td>
      <td className={`${tableClasses.cell} ${textClasses.numeric}`}>
        {run.startedAt !== null ? formatDateSecond(run.startedAt) : <Blank />}
      </td>
      <td className={`${tableClasses.cellEnd} ${textClasses.numeric}`}>
        {duration !== undefined ? formatDuration(duration) : <Blank />}
      </td>
      <td className={tableClasses.cell}>
        {run.progress !== null ? <RunProgress progress={run.progress} /> : <Blank />}
      </td>
      <td className={`${tableClasses.cell} ${textClasses.numeric}`}>
        {run.summary !== null ? formatSummary(run.summary) : <Blank />}
      </td>
      <td className={tableClasses.cell}>
        {error !== undefined ? (
          <span className={textClasses.twoLine}>
            <span>{error.name}</span>
            {error.code !== undefined && <small className={textClasses.small}>{error.code}</small>}
          </span>
        ) : (
          <Blank />
        )}
      </td>
    </tr>
  )
}

function RunHistory({ job, now }: { job: Job; now: Date }): React.JSX.Element {
  const runs = useJobRuns(job.name)
  const rows = runs.data?.pages.flatMap((page) => page.runs) ?? []

  function handleMore(): void {
    runs.fetchNextPage()
  }

  return (
    <>
      <div className={panelClasses.sectionHeading}>실행 이력</div>
      <div className={panelClasses.scroll}>
        <table className={tableClasses.table}>
          <thead>
            <tr>
              <th className={tableClasses.headCell}>계기</th>
              <th className={tableClasses.headCell}>상태</th>
              <th className={tableClasses.headCell}>시작</th>
              <th className={tableClasses.headCellEnd}>걸린 시간</th>
              <th className={tableClasses.headCell}>진행률</th>
              <th className={tableClasses.headCell}>결과</th>
              <th className={tableClasses.headCell}>오류</th>
            </tr>
          </thead>
          <tbody className={tableClasses.body}>
            {rows.map((run) => (
              <RunRow key={run.id} run={run} now={now} />
            ))}
          </tbody>
        </table>
      </div>
      {runs.hasNextPage && (
        <div className="flex justify-center py-3">
          <Button
            variant="secondary"
            size="sm"
            disabled={runs.isFetchingNextPage}
            onClick={handleMore}
          >
            더 보기
          </Button>
        </div>
      )}
    </>
  )
}

export function JobDetail({ job, now }: { job: Job; now: Date }): React.JSX.Element {
  const argNames = argInputs(job).map(({ name }) => name)

  return (
    <section aria-label={job.displayName} className={panelClasses.box}>
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
        <h2 className="m-0 text-xl font-semibold tracking-heading">{job.displayName}</h2>
        <span className="text-xs text-fg-subtle">{job.name}</span>
        <div className="ml-auto flex items-center gap-3">
          {job.schedule !== null && (
            <span className="inline-flex items-center gap-2 text-xs text-fg-muted">
              정기 실행
              <PauseSwitch job={job} />
            </span>
          )}
          <RunJobButton job={job} variant="primary" />
        </div>
      </div>
      <dl className="m-0 grid grid-cols-4 border-b border-line max-sm:grid-cols-2">
        <div className={FACT}>
          <dt className="text-xs font-medium text-fg-subtle">스케줄</dt>
          <dd className="m-0">
            <ScheduleText schedule={job.schedule} />
          </dd>
        </div>
        <div className={FACT}>
          <dt className="text-xs font-medium text-fg-subtle">다음 실행</dt>
          <dd className="m-0">
            <NextRunValue job={job} />
          </dd>
        </div>
        <div className={FACT}>
          <dt className="text-xs font-medium text-fg-subtle">지연 기준</dt>
          <dd className={`m-0 ${textClasses.numeric}`}>{`${job.delayMinutes}분`}</dd>
        </div>
        <div className={FACT}>
          <dt className="text-xs font-medium text-fg-subtle">인자</dt>
          <dd className="m-0">
            {argNames.length > 0 ? (
              argNames.join(', ')
            ) : (
              <span className={textClasses.subtle}>없음</span>
            )}
          </dd>
        </div>
      </dl>
      {job.activeRun !== null && <ActiveRun run={job.activeRun} now={now} />}
      <RunHistory key={job.name} job={job} now={now} />
    </section>
  )
}
