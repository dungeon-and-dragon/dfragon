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
import { panelClasses, textClasses } from './panel-classes'
import { PauseSwitch } from './PauseSwitch'
import { RunJobButton } from './RunJobButton'
import { RunProgress } from './RunProgress'
import { PausedTag, RunStatusTag } from './RunStatusTag'
import { ScheduleText } from './ScheduleText'

const FACT =
  'flex flex-col gap-1 border-r border-line px-4 py-3 last:border-r-0 max-sm:even:border-r-0 max-sm:nth-[-n+2]:border-b'
const ACTIVE_VALUE = 'num font-medium text-fg'

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

  return <span className="num">{formatDateMinute(job.nextRunAt)}</span>
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
    <tr>
      <td className={`${textClasses.muted}`}>{TRIGGER_LABELS[run.trigger]}</td>
      <td>
        <RunStatusTag status={run.status} />
      </td>
      <td className="num">
        {run.startedAt !== null ? formatDateSecond(run.startedAt) : <Blank />}
      </td>
      <td className="table-num">{duration !== undefined ? formatDuration(duration) : <Blank />}</td>
      <td>{run.progress !== null ? <RunProgress progress={run.progress} /> : <Blank />}</td>
      <td className="num">{run.summary !== null ? formatSummary(run.summary) : <Blank />}</td>
      <td>
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
      <div className="section-title">실행 이력</div>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>계기</th>
              <th>상태</th>
              <th>시작</th>
              <th className="table-num">걸린 시간</th>
              <th>진행률</th>
              <th>결과</th>
              <th>오류</th>
            </tr>
          </thead>
          <tbody>
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
        <h2 className="screen-title">{job.displayName}</h2>
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
      <dl className="grid grid-cols-4 border-b border-line max-sm:grid-cols-2">
        <div className={FACT}>
          <dt className="label">스케줄</dt>
          <dd>
            <ScheduleText schedule={job.schedule} />
          </dd>
        </div>
        <div className={FACT}>
          <dt className="label">다음 실행</dt>
          <dd>
            <NextRunValue job={job} />
          </dd>
        </div>
        <div className={FACT}>
          <dt className="label">지연 기준</dt>
          <dd className="num">{`${job.delayMinutes}분`}</dd>
        </div>
        <div className={FACT}>
          <dt className="label">인자</dt>
          <dd>
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
