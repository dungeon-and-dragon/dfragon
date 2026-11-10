import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { EMPTY_VALUE, formatCount, formatDateMinute } from '../format'
import { useCollection } from '../ops-queries'
import { styles } from './CollectionPanel.style'
import { panelStyles, tableStyles, textStyles } from './panel.style'
import { RequeueButton } from './RequeueButton'

export function CollectionPanel(): React.JSX.Element {
  const collection = useCollection()
  const summary = collection.data
  const failures = summary?.failures ?? []
  const failureTotal = failures.reduce((total, { count }) => total + count, 0)

  return (
    <section aria-label="수집 대기열" {...stylex.props(panelStyles.box)}>
      <h2 {...stylex.props(panelStyles.heading)}>
        수집 대기열
        <span {...stylex.props(panelStyles.headingActions)}>
          <RequeueButton
            label="전체 되돌리기"
            title="실패"
            failure={undefined}
            count={failureTotal}
          />
        </span>
      </h2>
      {summary !== undefined && (
        <dl {...stylex.props(styles.figures)}>
          <div {...stylex.props(styles.figure)}>
            <dt {...stylex.props(styles.figureLabel)}>대기</dt>
            <dd {...stylex.props(styles.figureValue)}>{formatCount(summary.waiting)}</dd>
          </div>
          <div {...stylex.props(styles.figure)}>
            <dt {...stylex.props(styles.figureLabel)}>가장 오래된 대기</dt>
            <dd {...stylex.props(styles.figureValue, styles.figureTime)}>
              {summary.oldestQueuedAt !== null
                ? formatDateMinute(summary.oldestQueuedAt)
                : EMPTY_VALUE}
            </dd>
          </div>
        </dl>
      )}
      {failures.length > 0 && (
        <table {...stylex.props(tableStyles.table)}>
          <thead>
            <tr>
              <th {...stylex.props(tableStyles.headerCell)}>실패 종류</th>
              <th {...stylex.props(tableStyles.headerCell, tableStyles.end)}>건수</th>
              <th {...stylex.props(tableStyles.headerCell)}>마지막 시도</th>
              <th {...stylex.props(tableStyles.headerCell, tableStyles.end)}>
                <span {...stylex.props(shapes.srOnly)}>되돌리기</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {failures.map(({ failure, count, lastAttemptedAt }) => (
              <tr key={failure} {...stylex.props(tableStyles.row)}>
                <td {...stylex.props(tableStyles.cell)}>{failure}</td>
                <td {...stylex.props(tableStyles.cell, tableStyles.end, tableStyles.numeric)}>
                  {formatCount(count)}
                </td>
                <td {...stylex.props(tableStyles.cell, textStyles.muted, tableStyles.numeric)}>
                  {lastAttemptedAt !== null ? formatDateMinute(lastAttemptedAt) : EMPTY_VALUE}
                </td>
                <td {...stylex.props(tableStyles.cell, tableStyles.end)}>
                  <RequeueButton label="되돌리기" title={failure} failure={failure} count={count} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
