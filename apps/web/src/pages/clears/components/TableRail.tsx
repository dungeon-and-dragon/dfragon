import * as stylex from '@stylexjs/stylex'
import { styles } from '../../../components/chart/chart.style'

export function TableRail({
  percent,
  active,
  dimmed
}: {
  percent: number
  active: boolean
  dimmed: boolean
}): React.JSX.Element {
  return (
    <span {...stylex.props(styles.rail, styles.tableRail)}>
      <span data-chart-mark="" {...stylex.props(styles.rowMark, styles.rowWidth(percent))}>
        <span
          {...stylex.props(
            styles.body,
            styles.rowBodyCount,
            active && styles.bodyActive,
            dimmed && styles.bodyDimmed
          )}
        />
        <span
          {...stylex.props(
            styles.edge,
            styles.rowEdge,
            styles.edgeCount,
            dimmed && styles.edgeDimmed
          )}
        />
      </span>
    </span>
  )
}
