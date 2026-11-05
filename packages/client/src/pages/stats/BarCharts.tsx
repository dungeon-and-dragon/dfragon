import * as stylex from '@stylexjs/stylex'
import { styles } from './StatsScreen.style'

const integer = new Intl.NumberFormat('ko-KR')
// 막대 열이 좁아 14개 구간의 수가 한 줄에 들어가도록 줄여 쓴다.
const compact = new Intl.NumberFormat('ko-KR', { notation: 'compact' })

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
          <span {...stylex.props(styles.columnValue)}>{compact.format(value)}</span>
          <span {...stylex.props(styles.columnTrack)}>
            <span {...stylex.props(styles.columnBar, styles.columnHeight(percentOf(value, max)))} />
          </span>
          <span {...stylex.props(styles.columnLabel)}>{name}</span>
        </li>
      ))}
    </ul>
  )
}
