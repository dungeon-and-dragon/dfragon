import * as stylex from '@stylexjs/stylex'
import { styles } from '../../../components/chart/chart.style'

export function TableRail({
  percent,
  dimmed
}: {
  percent: number
  dimmed: boolean
}): React.JSX.Element {
  return (
    <span {...stylex.props(styles.rail, styles.tableRail)}>
      <span data-chart-mark="" {...stylex.props(styles.rowMark, styles.rowWidth(percent))}>
        <span
          {...stylex.props(
            styles.body,
            styles.rowBody,
            styles.bodyCount,
            dimmed && styles.bodyDimmed
          )}
        />
      </span>
    </span>
  )
}
