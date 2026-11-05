import * as stylex from '@stylexjs/stylex'
import { styles } from './StatsScreen.style'

const integer = new Intl.NumberFormat('ko-KR')

export type Bar = Readonly<{ key: string; name: string; value: number }>

function percentOf(value: number, max: number): number {
  if (max <= 0) {
    return 0
  }

  return (value / max) * 100
}

export function RowBars({ bars }: { bars: readonly Bar[] }): React.JSX.Element {
  const max = Math.max(0, ...bars.map(({ value }) => value))

  return (
    <ul {...stylex.props(styles.rows)}>
      {bars.map(({ key, name, value }) => (
        <li key={key} {...stylex.props(styles.row)}>
          <span {...stylex.props(styles.rowName)}>{name}</span>
          <span {...stylex.props(styles.track)}>
            <span {...stylex.props(styles.bar, styles.barWidth(percentOf(value, max)))} />
          </span>
          <span {...stylex.props(styles.value)}>{integer.format(value)}</span>
        </li>
      ))}
    </ul>
  )
}

export function ColumnBars({ bars }: { bars: readonly Bar[] }): React.JSX.Element {
  const max = Math.max(0, ...bars.map(({ value }) => value))

  return (
    <ul {...stylex.props(styles.columns)}>
      {bars.map(({ key, name, value }) => (
        <li key={key} {...stylex.props(styles.column)}>
          <span>{integer.format(value)}</span>
          <span {...stylex.props(styles.columnTrack)}>
            <span {...stylex.props(styles.columnBar, styles.columnHeight(percentOf(value, max)))} />
          </span>
          <span {...stylex.props(styles.columnLabel)}>{name}</span>
        </li>
      ))}
    </ul>
  )
}
