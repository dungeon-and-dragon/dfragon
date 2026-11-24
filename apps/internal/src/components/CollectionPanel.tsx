import { EMPTY_VALUE, formatCount, formatDateMinute } from '#ops-app/format'
import { useCollection } from '#ops-app/ops-queries'
import { panelClasses, textClasses } from './panel-classes'
import { RequeueButton } from './RequeueButton'

export function CollectionPanel(): React.JSX.Element {
  const collection = useCollection()
  const summary = collection.data
  const failures = summary?.failures ?? []
  const failureTotal = failures.reduce((total, { count }) => total + count, 0)

  return (
    <section aria-label="수집 대기열" className={panelClasses.box}>
      <h2 className="section-title">
        수집 대기열
        <span className="section-title-actions">
          <RequeueButton
            label="전체 되돌리기"
            title="실패"
            failure={undefined}
            count={failureTotal}
          />
        </span>
      </h2>
      {summary !== undefined && (
        <dl className="flex gap-12 border-b border-line p-4 max-sm:gap-6">
          <div className="stat">
            <dt className="stat-label">대기</dt>
            <dd className="stat-value">{formatCount(summary.waiting)}</dd>
          </div>
          <div className="stat">
            <dt className="stat-label">가장 오래된 대기</dt>
            <dd className="stat-value">
              {summary.oldestQueuedAt !== null
                ? formatDateMinute(summary.oldestQueuedAt)
                : EMPTY_VALUE}
            </dd>
          </div>
        </dl>
      )}
      {failures.length > 0 && (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>실패 종류</th>
                <th className="table-num">건수</th>
                <th>마지막 시도</th>
                <th className="table-num" />
              </tr>
            </thead>
            <tbody>
              {failures.map(({ failure, count, lastAttemptedAt }) => (
                <tr key={failure}>
                  <td>{failure}</td>
                  <td className="table-num">{formatCount(count)}</td>
                  <td className={`${textClasses.muted} num`}>
                    {lastAttemptedAt !== null ? formatDateMinute(lastAttemptedAt) : EMPTY_VALUE}
                  </td>
                  <td className="text-right">
                    <RequeueButton
                      label="되돌리기"
                      title={failure}
                      failure={failure}
                      count={count}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
