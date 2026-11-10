import { Button } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
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
import { styles } from './JobDetail.style'
import { panelStyles, tableStyles, textStyles } from './panel.style'
import { PauseSwitch } from './PauseSwitch'
import { RunJobButton } from './RunJobButton'
import { RunProgress } from './RunProgress'
import { PausedTag, RunStatusTag } from './RunStatusTag'
import { ScheduleText } from './ScheduleText'

function Blank(): React.JSX.Element {
  return <span {...stylex.props(textStyles.subtle)}>{EMPTY_VALUE}</span>
}

function NextRunValue({ job }: { job: Job }): React.JSX.Element {
  if (job.paused) {
    return <PausedTag />
  }

  if (job.nextRunAt === null) {
    return <Blank />
  }

  return <>{formatDateMinute(job.nextRunAt)}</>
}

function ActiveRun({ run, now }: { run: Run; now: Date }): React.JSX.Element {
  const elapsed = runDuration(run, now)

  return (
    <div {...stylex.props(styles.active)}>
      <RunStatusTag status={run.status} />
      {run.progress !== null && <RunProgress progress={run.progress} wide />}
      <span {...stylex.props(styles.activeMeta)}>
        <span>{TRIGGER_LABELS[run.trigger]}</span>
        {run.startedAt !== null ? (
          <span>
            시작 <b {...stylex.props(styles.activeValue)}>{formatDateSecond(run.startedAt)}</b>
          </span>
        ) : (
          <span>
            요청 <b {...stylex.props(styles.activeValue)}>{formatDateSecond(run.requestedAt)}</b>
          </span>
        )}
        {elapsed !== undefined && (
          <span>
            경과 <b {...stylex.props(styles.activeValue)}>{formatDuration(elapsed)}</b>
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
    <tr {...stylex.props(tableStyles.row)}>
      <td {...stylex.props(tableStyles.cell, textStyles.muted)}>{TRIGGER_LABELS[run.trigger]}</td>
      <td {...stylex.props(tableStyles.cell)}>
        <RunStatusTag status={run.status} />
      </td>
      <td {...stylex.props(tableStyles.cell, tableStyles.numeric)}>
        {run.startedAt !== null ? formatDateSecond(run.startedAt) : EMPTY_VALUE}
      </td>
      <td {...stylex.props(tableStyles.cell, tableStyles.end, tableStyles.numeric)}>
        {duration !== undefined ? formatDuration(duration) : EMPTY_VALUE}
      </td>
      <td {...stylex.props(tableStyles.cell)}>
        {run.progress !== null ? <RunProgress progress={run.progress} /> : <Blank />}
      </td>
      <td {...stylex.props(tableStyles.cell, tableStyles.numeric)}>
        {run.summary !== null ? formatSummary(run.summary) : <Blank />}
      </td>
      <td {...stylex.props(tableStyles.cell)}>
        {error !== undefined ? (
          <span {...stylex.props(textStyles.twoLine)}>
            <span>{error.name}</span>
            {error.code !== undefined && (
              <small {...stylex.props(textStyles.small)}>{error.code}</small>
            )}
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
      <div {...stylex.props(panelStyles.sectionHeading)}>실행 이력</div>
      <div {...stylex.props(panelStyles.scroll)}>
        <table {...stylex.props(tableStyles.table)}>
          <thead>
            <tr>
              <th {...stylex.props(tableStyles.headerCell)}>계기</th>
              <th {...stylex.props(tableStyles.headerCell)}>상태</th>
              <th {...stylex.props(tableStyles.headerCell)}>시작</th>
              <th {...stylex.props(tableStyles.headerCell, tableStyles.end)}>걸린 시간</th>
              <th {...stylex.props(tableStyles.headerCell)}>진행률</th>
              <th {...stylex.props(tableStyles.headerCell)}>결과</th>
              <th {...stylex.props(tableStyles.headerCell)}>오류</th>
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
        <div {...stylex.props(styles.more)}>
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
    <section aria-label={job.displayName} {...stylex.props(panelStyles.box)}>
      <div {...stylex.props(styles.header)}>
        <h2 {...stylex.props(styles.title)}>{job.displayName}</h2>
        <span {...stylex.props(styles.code)}>{job.name}</span>
        <div {...stylex.props(styles.actions)}>
          {job.schedule !== null && (
            <span {...stylex.props(styles.switchLabel)}>
              정기 실행
              <PauseSwitch job={job} />
            </span>
          )}
          <RunJobButton job={job} variant="primary" />
        </div>
      </div>
      <dl {...stylex.props(styles.facts)}>
        <div {...stylex.props(styles.fact)}>
          <dt {...stylex.props(styles.factLabel)}>스케줄</dt>
          <dd {...stylex.props(styles.factValue)}>
            <ScheduleText schedule={job.schedule} />
          </dd>
        </div>
        <div {...stylex.props(styles.fact)}>
          <dt {...stylex.props(styles.factLabel)}>다음 실행</dt>
          <dd {...stylex.props(styles.factValue)}>
            <NextRunValue job={job} />
          </dd>
        </div>
        <div {...stylex.props(styles.fact)}>
          <dt {...stylex.props(styles.factLabel)}>지연 기준</dt>
          <dd {...stylex.props(styles.factValue)}>{`${job.delayMinutes}분`}</dd>
        </div>
        <div {...stylex.props(styles.fact)}>
          <dt {...stylex.props(styles.factLabel)}>인자</dt>
          <dd {...stylex.props(styles.factValue)}>
            {argNames.length > 0 ? (
              argNames.join(', ')
            ) : (
              <span {...stylex.props(textStyles.subtle)}>없음</span>
            )}
          </dd>
        </div>
      </dl>
      {job.activeRun !== null && <ActiveRun run={job.activeRun} now={now} />}
      <RunHistory key={job.name} job={job} now={now} />
    </section>
  )
}
