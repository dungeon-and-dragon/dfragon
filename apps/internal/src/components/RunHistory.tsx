import { Button } from '@dfragon/ui'
import type { Job, RunPage } from '#ops-api/ops-schemas'
import {
  EMPTY_VALUE,
  formatDateSecond,
  formatDuration,
  formatSummary,
  runDuration,
  TRIGGER_LABELS
} from '#ops-app/format'
import { useRunHistory } from '#ops-app/ops-queries'
import { panelClasses, textClasses } from './panel-classes'
import { RunProgress } from './RunProgress'
import { RunStatusTag } from './RunStatusTag'

type HistoryRun = RunPage['runs'][number]

function Blank(): React.JSX.Element {
  return <span className={textClasses.subtle}>{EMPTY_VALUE}</span>
}

function RunRow({
  run,
  displayName,
  now
}: {
  run: HistoryRun
  displayName: string
  now: Date
}): React.JSX.Element {
  const duration = runDuration(run, now)
  const [error] = run.error ?? []

  return (
    <tr>
      <td>
        <span className={textClasses.twoLine}>
          <span className="font-semibold text-fg">{displayName}</span>
          <small className={textClasses.small}>{run.jobName}</small>
        </span>
      </td>
      <td className={textClasses.muted}>{TRIGGER_LABELS[run.trigger]}</td>
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

export function RunHistory({ jobs, now }: { jobs: readonly Job[]; now: Date }): React.JSX.Element {
  const runs = useRunHistory()
  const rows = runs.data?.pages.flatMap((page) => page.runs) ?? []
  const displayNames = new Map(jobs.map(({ name, displayName }) => [name, displayName]))

  function handleMore(): void {
    runs.fetchNextPage()
  }

  return (
    <section aria-label="실행 이력" className={panelClasses.box}>
      <h2 className="section-title">실행 이력</h2>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>job</th>
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
              <RunRow
                key={run.id}
                run={run}
                displayName={displayNames.get(run.jobName) ?? run.jobName}
                now={now}
              />
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
    </section>
  )
}
