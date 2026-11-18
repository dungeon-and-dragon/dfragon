import { EMPTY_VALUE, formatCount, formatDateMinute } from '../format'
import { useCollection } from '../ops-queries'
import { panelClasses, tableClasses, textClasses } from './panel-classes'
import { RequeueButton } from './RequeueButton'

const FIGURE_VALUE = 'm-0 font-mono font-semibold tabular-nums'

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
        <dl className="m-0 flex gap-12 border-b border-line p-4 max-sm:gap-6">
          <div className="flex flex-col gap-1">
            <dt className="text-xs font-medium text-fg-subtle">대기</dt>
            <dd className={`${FIGURE_VALUE} text-xl`}>{formatCount(summary.waiting)}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs font-medium text-fg-subtle">가장 오래된 대기</dt>
            <dd className={`${FIGURE_VALUE} text-base`}>
              {summary.oldestQueuedAt !== null
                ? formatDateMinute(summary.oldestQueuedAt)
                : EMPTY_VALUE}
            </dd>
          </div>
        </dl>
      )}
      {failures.length > 0 && (
        <div className={panelClasses.scroll}>
          <table className={tableClasses.table}>
            <thead>
              <tr>
                <th className={tableClasses.headCell}>실패 종류</th>
                <th className={tableClasses.headCellEnd}>건수</th>
                <th className={tableClasses.headCell}>마지막 시도</th>
                <th className={tableClasses.headCellEnd}>
                  <span className="sr-only">되돌리기</span>
                </th>
              </tr>
            </thead>
            <tbody className={tableClasses.body}>
              {failures.map(({ failure, count, lastAttemptedAt }) => (
                <tr key={failure} className={tableClasses.row}>
                  <td className={tableClasses.cell}>{failure}</td>
                  <td className={`${tableClasses.cellEnd} ${textClasses.numeric}`}>
                    {formatCount(count)}
                  </td>
                  <td
                    className={`${tableClasses.cell} ${textClasses.muted} ${textClasses.numeric}`}
                  >
                    {lastAttemptedAt !== null ? formatDateMinute(lastAttemptedAt) : EMPTY_VALUE}
                  </td>
                  <td className={tableClasses.cellEnd}>
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
